import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, prefer",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

    if (!supabaseUrl || !serviceKey) {
      throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    }

    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ ok: false, error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const callerClient = createClient(supabaseUrl, anonKey || serviceKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: userData, error: userErr } = await callerClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ ok: false, error: "Invalid session" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const items = Array.isArray(body.notifications) ? body.notifications : [body];
    if (!items.length || !items[0]?.receiver) {
      return new Response(JSON.stringify({ ok: false, error: "receiver required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const created = [];
    for (const item of items) {
      if (!item.receiver || !item.title || !item.message || !item.module) continue;

      const { data: notif, error } = await admin
        .from("notifications")
        .insert({
          receiver: item.receiver,
          sender: item.sender || userData.user.id,
          module: item.module,
          reference_id: item.referenceId || item.reference_id || null,
          title: item.title,
          message: item.message,
          action_required: !!item.actionRequired || !!item.action_required,
          priority: item.priority || "Normal",
          expire_date: item.expireDate || item.expire_date || null,
          metadata: item.metadata || {},
        })
        .select("*")
        .single();

      if (error) throw error;

      const actions = Array.isArray(item.actions) ? item.actions : [];
      if (actions.length) {
        const rows = actions.map((a) => ({
          notification_id: notif.id,
          action_key: a.action_key || a.actionKey || a.key,
          label: a.label,
          module: a.module || item.module,
          reference_id: a.reference_id || a.referenceId || item.referenceId || item.reference_id || null,
          metadata: a.metadata || {},
        }));
        await admin.from("notification_actions").insert(rows);
      }

      created.push(notif);
    }

    return new Response(JSON.stringify({ ok: true, count: created.length, notifications: created }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: err.message || String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
