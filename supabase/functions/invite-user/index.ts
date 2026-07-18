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

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function upsertInviteProfile(
  admin: ReturnType<typeof createClient>,
  row: {
    id: string;
    email: string;
    performer_name: string;
    role: string;
    client_id?: string;
    onboarding?: string;
  },
) {
  const withOnboarding = { ...row, client_id: row.client_id || "DEFAULT_CLIENT" };
  const { error } = await admin.from("profiles").upsert(withOnboarding, { onConflict: "id" });
  if (!error) {
    await admin
      .from("profiles")
      .update({
        role: row.role,
        email: row.email,
        performer_name: row.performer_name,
        onboarding: row.onboarding,
      })
      .eq("id", row.id);
    return;
  }
  if (!/onboarding/i.test(error.message || "")) throw error;

  const { onboarding: _omit, ...without } = withOnboarding;
  await admin.from("profiles").upsert(without, { onConflict: "id" });
  await admin
    .from("profiles")
    .update({
      role: row.role,
      email: row.email,
      performer_name: row.performer_name,
    })
    .eq("id", row.id);
}

async function findProfileByEmail(admin: ReturnType<typeof createClient>, email: string) {
  const full = await admin
    .from("profiles")
    .select("id, email, role, email_confirmed_at, performer_name, onboarding")
    .ilike("email", email)
    .maybeSingle();

  if (!full.error) return full.data;

  if (!/onboarding/i.test(full.error.message || "")) throw full.error;

  const fallback = await admin
    .from("profiles")
    .select("id, email, role, email_confirmed_at, performer_name")
    .ilike("email", email)
    .maybeSingle();

  if (fallback.error) throw fallback.error;
  return fallback.data ? { ...fallback.data, onboarding: null as string | null } : null;
}

/** Resolve invite vs signup path; prefer explicit hint, then profile, then Auth. */
async function resolveOnboarding(
  admin: ReturnType<typeof createClient>,
  profile: { id: string; onboarding?: string | null } | null,
  hint?: string | null,
) {
  if (hint === "invite" || hint === "signup") {
    if (profile?.id && profile.onboarding !== hint) {
      await admin.from("profiles").update({ onboarding: hint }).eq("id", profile.id);
    }
    return hint;
  }
  if (profile?.onboarding === "invite" || profile?.onboarding === "signup") {
    return profile.onboarding;
  }
  if (!profile?.id) return null;

  const { data } = await admin.auth.admin.getUserById(profile.id);
  const authUser = data?.user;
  const inferred = authUser?.invited_at ? "invite" : "signup";

  await admin.from("profiles").update({ onboarding: inferred }).eq("id", profile.id);
  return inferred as "invite" | "signup";
}

async function resendSignupConfirmation(
  supabaseUrl: string,
  serviceKey: string,
  email: string,
  redirectTo: string,
) {
  const res = await fetch(`${supabaseUrl}/auth/v1/resend`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      apikey: serviceKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      type: "signup",
      email,
      options: { email_redirect_to: redirectTo },
    }),
  });

  if (res.ok) return { ok: true as const };

  const errBody = await res.json().catch(() => ({}));
  const message =
    (errBody as { msg?: string; error_description?: string; message?: string })?.msg ||
    (errBody as { error_description?: string })?.error_description ||
    (errBody as { message?: string })?.message ||
    `Confirmation resend failed (${res.status})`;

  if (res.status >= 400) {
    const retry = await fetch(`${supabaseUrl}/auth/v1/resend`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "signup",
        email,
        email_redirect_to: redirectTo,
      }),
    });
    if (retry.ok) return { ok: true as const };
  }

  return { ok: false as const, error: message };
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
      return jsonResponse({ ok: false, error: "Missing authorization" }, 401);
    }

    const callerClient = createClient(supabaseUrl, anonKey || serviceKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: userData, error: userErr } = await callerClient.auth.getUser();
    if (userErr || !userData?.user) {
      return jsonResponse({ ok: false, error: "Invalid session" }, 401);
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
      return jsonResponse({ ok: false, error: "Access denied" }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const action = body.action === "resend" ? "resend" : "invite";
    const email = String(body.email || "").trim().toLowerCase();
    let role = String(body.role || "performer").trim();
    const onboardingHint =
      body.onboarding === "invite" || body.onboarding === "signup" ? body.onboarding : null;

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return jsonResponse({ ok: false, error: "Valid email is required" }, 400);
    }

    if (!ALLOWED_ROLES.includes(role)) role = "performer";

    const displayName =
      String(body.displayName || "").trim() || deriveDisplayNameFromEmail(email);

    const redirectTo = appUrl.endsWith("/") ? appUrl : `${appUrl}/`;

    const existingProfile = await findProfileByEmail(admin, email);

    // ── Cross-create guard: never invite over an existing account ──
    if (action === "invite" && existingProfile) {
      if (existingProfile.email_confirmed_at) {
        return jsonResponse(
          { ok: false, error: "A verified user with this email already exists" },
          409,
        );
      }

      const path = await resolveOnboarding(admin, existingProfile, onboardingHint);
      if (path === "invite") {
        return jsonResponse(
          {
            ok: false,
            error:
              "A pending invite already exists for this email. Use Resend in User Management, or delete the pending user first.",
            onboarding: "invite",
          },
          409,
        );
      }
      if (path === "signup") {
        return jsonResponse(
          {
            ok: false,
            error:
              "A pending signup already exists for this email. Use Resend confirmation in User Management, or delete the pending user then send Admin Invite.",
            onboarding: "signup",
          },
          409,
        );
      }
      return jsonResponse(
        {
          ok: false,
          error:
            "A pending account already exists for this email. Use Resend or delete the pending user before inviting.",
        },
        409,
      );
    }

    // ── Resend: split invite vs signup confirmation ──
    if (action === "resend") {
      if (!existingProfile?.id) {
        return jsonResponse(
          { ok: false, error: "No pending account found for this email" },
          404,
        );
      }
      if (existingProfile.email_confirmed_at) {
        return jsonResponse(
          { ok: false, error: "User is already verified — nothing to resend" },
          409,
        );
      }

      const onboarding = await resolveOnboarding(admin, existingProfile, onboardingHint);

      const profilePatch: Record<string, unknown> = {
        role,
        performer_name: existingProfile.performer_name || displayName,
        email,
      };
      if (onboarding) profilePatch.onboarding = onboarding;

      const { error: patchErr } = await admin
        .from("profiles")
        .update(profilePatch)
        .eq("id", existingProfile.id);

      if (patchErr && /onboarding/i.test(patchErr.message || "")) {
        delete profilePatch.onboarding;
        await admin.from("profiles").update(profilePatch).eq("id", existingProfile.id);
      } else if (patchErr) {
        throw patchErr;
      }

      await admin.auth.admin.updateUserById(existingProfile.id, {
        user_metadata: {
          role,
          performer_name: displayName,
          full_name: displayName,
          onboarding: onboarding || "invite",
        },
      });

      if (onboarding === "signup") {
        const result = await resendSignupConfirmation(
          supabaseUrl,
          serviceKey,
          email,
          redirectTo,
        );
        if (!result.ok) {
          return jsonResponse(
            {
              ok: false,
              error:
                result.error ||
                "Could not resend confirmation email. Delete the pending user and use Add New User / Signup again.",
              onboarding: "signup",
            },
            409,
          );
        }
        return jsonResponse({
          ok: true,
          action: "resend",
          kind: "signup",
          email,
          onboarding: "signup",
        });
      }

      // Invite-pending: try inviteUserByEmail, then generateLink invite
      const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
        redirectTo,
        data: {
          role,
          performer_name: displayName,
          full_name: displayName,
          onboarding: "invite",
        },
      });

      if (inviteError) {
        if (!/already|registered|exists/i.test(inviteError.message)) {
          throw inviteError;
        }

        const { error: genErr } = await admin.auth.admin.generateLink({
          type: "invite",
          email,
          options: {
            redirectTo,
            data: {
              role,
              performer_name: displayName,
              full_name: displayName,
              onboarding: "invite",
            },
          },
        });

        if (genErr) {
          return jsonResponse(
            {
              ok: false,
              error:
                "Invite could not be resent. Delete the pending user and send a fresh Admin Invite.",
              onboarding: "invite",
            },
            409,
          );
        }

        return jsonResponse({
          ok: true,
          action: "resend",
          kind: "invite",
          email,
          onboarding: "invite",
          note: "Invite link regenerated. If no email arrives, delete the pending user and send a fresh Admin Invite.",
        });
      }

      return jsonResponse({
        ok: true,
        action: "resend",
        kind: "invite",
        email,
        onboarding: "invite",
      });
    }

    // ── Fresh Admin Invite ──
    const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo,
      data: {
        role,
        performer_name: displayName,
        full_name: displayName,
        onboarding: "invite",
      },
    });

    if (inviteError) {
      if (/already|registered|exists/i.test(inviteError.message)) {
        return jsonResponse(
          {
            ok: false,
            error:
              "User already exists in Auth. Use Resend for pending accounts, or update role in User Management.",
          },
          409,
        );
      }
      throw inviteError;
    }

    const userId = invited?.user?.id;
    if (userId) {
      await upsertInviteProfile(admin, {
        id: userId,
        email,
        performer_name: displayName,
        role,
        client_id: "DEFAULT_CLIENT",
        onboarding: "invite",
      });
    }

    return jsonResponse({
      ok: true,
      action: "invite",
      kind: "invite",
      email,
      userId,
      displayName,
      role,
      onboarding: "invite",
    });
  } catch (error) {
    return jsonResponse(
      { ok: false, error: String((error as Error)?.message || error) },
      500,
    );
  }
});
