import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const STALE_HOURS = 48;
const DEDUPE_HOURS = 24;
const STATUSES = ["Assigned", "In Progress", "Need Information"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!supabaseUrl || !serviceKey) {
      throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    }

    // Allow service-role cron OR authenticated super_admin trigger
    const authHeader = req.headers.get("Authorization") || "";
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const isServiceCall =
      authHeader === `Bearer ${serviceKey}` ||
      authHeader.includes(serviceKey);

    if (!isServiceCall && authHeader.startsWith("Bearer ")) {
      const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
      const caller = createClient(supabaseUrl, anonKey || serviceKey, {
        global: { headers: { Authorization: authHeader } },
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data: userData } = await caller.auth.getUser();
      if (!userData?.user) {
        return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: profile } = await admin
        .from("profiles")
        .select("role")
        .eq("id", userData.user.id)
        .single();
      if (!["super_admin", "general_manager"].includes(profile?.role)) {
        return new Response(JSON.stringify({ ok: false, error: "Access denied" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else if (!isServiceCall) {
      return new Response(JSON.stringify({ ok: false, error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cutoff = new Date(Date.now() - STALE_HOURS * 60 * 60 * 1000).toISOString();
    const dedupeSince = new Date(Date.now() - DEDUPE_HOURS * 60 * 60 * 1000).toISOString();

    const { data: tickets, error } = await admin
      .from("request_hub_tickets")
      .select("*")
      .in("status", STATUSES)
      .is("archived_at", null)
      .lt("last_activity_at", cutoff);

    if (error) throw error;

    let reminded = 0;
    for (const ticket of tickets || []) {
      const { data: recent } = await admin
        .from("request_hub_reminder_deliveries")
        .select("id")
        .eq("ticket_id", ticket.id)
        .eq("reminder_kind", "stale_assigned_48h")
        .gte("created_at", dedupeSince)
        .limit(1);

      if (recent?.length) continue;

      const notifyIds = new Set();
      if (ticket.assigned_to) notifyIds.add(ticket.assigned_to);

      // Relevant lead: group/team leads for ticket client scope
      if (ticket.client_ref) {
        const { data: leads } = await admin
          .from("profiles")
          .select("id")
          .eq("client_ref", ticket.client_ref)
          .in("role", ["team_lead", "group_lead"]);
        (leads || []).forEach((l) => notifyIds.add(l.id));
      }

      const ids = [...notifyIds];
      if (!ids.length) continue;

      const notifRows = ids.map((receiver) => ({
        receiver,
        sender: null,
        module: "smart_request_hub",
        reference_id: ticket.id,
        title: `Reminder · ${ticket.ticket_number}`,
        message: `No update in ${STALE_HOURS}h · ${ticket.title}`,
        action_required: true,
        priority: "High",
        metadata: { reminder: true, ticket_number: ticket.ticket_number },
      }));

      await admin.from("notifications").insert(notifRows);

      await admin.from("request_hub_reminder_deliveries").insert({
        ticket_id: ticket.id,
        reminder_kind: "stale_assigned_48h",
        notified_user_ids: ids,
        metadata: { status: ticket.status },
      });

      reminded += 1;
    }

    return new Response(JSON.stringify({ ok: true, reminded, scanned: (tickets || []).length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: err.message || String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
