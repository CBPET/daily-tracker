import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ALLOWED_ROLES = [
  "super_admin",
  "general_manager",
  "manager",
  "group_lead",
  "team_lead",
  "performer",
];

function deriveDisplayNameFromEmail(email: string) {
  const local = String(email || "").trim().split("@")[0] || "";
  if (!local) return "New Performer";
  return local
    .split("+")[0]
    .replace(/[._-]+/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ") || "New Performer";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const appUrl = Deno.env.get("APP_URL") ?? "https://arockiaalexander.github.io/Daily-Tracker/";

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

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: callerProfile, error: profileErr } = await admin
      .from("profiles")
      .select("id, role")
      .eq("id", userData.user.id)
      .single();

    if (profileErr || !callerProfile) {
      throw new Error("Caller profile not found");
    }

    if (!["super_admin", "general_manager"].includes(callerProfile.role)) {
      return new Response(JSON.stringify({ ok: false, error: "Access denied" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const action = body.action === "resend" ? "resend" : "invite";
    const email = String(body.email || "").trim().toLowerCase();
    let role = String(body.role || "performer").trim();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(JSON.stringify({ ok: false, error: "Valid email is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!ALLOWED_ROLES.includes(role)) role = "performer";

    const displayName =
      String(body.displayName || "").trim() || deriveDisplayNameFromEmail(email);

    const redirectTo = appUrl.endsWith("/") ? appUrl : `${appUrl}/`;

    const { data: existingProfile } = await admin
      .from("profiles")
      .select("id, email, role, email_confirmed_at, performer_name")
      .ilike("email", email)
      .maybeSingle();

    if (action === "invite" && existingProfile?.email_confirmed_at) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "A verified user with this email already exists",
        }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // invite or resend: send Auth invite email via project SMTP
    const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo,
      data: {
        role,
        performer_name: displayName,
        full_name: displayName,
      },
    });

    if (inviteError) {
      if (/already|registered|exists/i.test(inviteError.message)) {
        if (action === "resend" && existingProfile?.id && !existingProfile.email_confirmed_at) {
          // Pending account exists — update role/name and ask Auth to resend signup/invite style mail via recovery is wrong;
          // generate invite link (admin can also use dashboard). Try invite once more after soft metadata update.
          await admin.from("profiles").update({
            role,
            performer_name: existingProfile.performer_name || displayName,
            email,
          }).eq("id", existingProfile.id);

          await admin.auth.admin.updateUserById(existingProfile.id, {
            user_metadata: { role, performer_name: displayName, full_name: displayName },
          });

          // Use generateLink invite; Auth may not email — also try magiclink email via OTP invite path
          const { error: genErr } = await admin.auth.admin.generateLink({
            type: "invite",
            email,
            options: {
              redirectTo,
              data: { role, performer_name: displayName, full_name: displayName },
            },
          });

          if (genErr) {
            return new Response(
              JSON.stringify({
                ok: false,
                error: "User exists but invite could not be resent. Delete the pending user and invite again, or use Forgot Password if they already set a password.",
              }),
              { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
            );
          }

          return new Response(
            JSON.stringify({
              ok: true,
              action: "resend",
              email,
              note: "Invite link regenerated. If no email arrives, delete the pending user and send a fresh Admin Invite.",
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }

        return new Response(
          JSON.stringify({
            ok: false,
            error: "User already exists. Use Resend for pending accounts, or update role in User Management.",
          }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      throw inviteError;
    }

    const userId = invited?.user?.id || existingProfile?.id;
    if (userId) {
      await admin.from("profiles").upsert(
        {
          id: userId,
          email,
          performer_name: displayName,
          role,
          client_id: "DEFAULT_CLIENT",
        },
        { onConflict: "id" },
      );
      await admin.from("profiles").update({ role, email, performer_name: displayName }).eq("id", userId);
    }

    return new Response(
      JSON.stringify({ ok: true, action, email, userId, displayName, role }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ ok: false, error: String((error as Error)?.message || error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
