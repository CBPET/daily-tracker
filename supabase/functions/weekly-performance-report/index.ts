import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
  aggregateByPerformer,
  buildAnalyticsDeepLink,
  getPreviousWeekRange,
  partitionByDivision,
} from "../_shared/performanceRating.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const resendKey = Deno.env.get("RESEND_API_KEY") ?? "";
    const fromEmail = Deno.env.get("REPORT_FROM_EMAIL") ?? "reports@example.com";
    const appUrl = Deno.env.get("APP_URL") ?? "https://arockiaalexander.github.io/Daily-Tracker";

    if (!supabaseUrl || !serviceKey) {
      throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    }
    if (!resendKey) {
      throw new Error("Missing RESEND_API_KEY");
    }

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { start, end } = getPreviousWeekRange(new Date());

    // Explicit date-scoped fetch (service role bypasses RLS — never broaden beyond week)
    const { data: entries, error: entriesError } = await supabase
      .from("status_entries")
      .select("*")
      .gte("date", start)
      .lte("date", end);

    if (entriesError) throw entriesError;

    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, email, performer_name, role, client_id, sub_division, is_active")
      .eq("is_active", true);

    if (profilesError) throw profilesError;

    const managers = (profiles || []).filter((p) =>
      ["manager", "general_manager"].includes(p.role) && p.email
    );
    const managerEmails = [...new Set(managers.map((p) => p.email))];

    const divisions = partitionByDivision(entries || []);
    const results = [];

    for (const division of divisions) {
      const { client_id, sub_division, entries: divEntries } = division;

      // Idempotency: skip if already sent for this week + division
      const { data: existing } = await supabase
        .from("weekly_report_deliveries")
        .select("id, status")
        .eq("week_start", start)
        .eq("client_id", client_id)
        .eq("sub_division", sub_division)
        .maybeSingle();

      if (existing?.status === "sent") {
        results.push({ client_id, sub_division, status: "skipped", reason: "already_sent" });
        continue;
      }

      const ranked = aggregateByPerformer(divEntries);
      const deepLink = buildAnalyticsDeepLink({
        baseUrl: appUrl,
        client: client_id,
        division: sub_division,
        start,
        end,
      });

      const groupLeads = (profiles || []).filter(
        (p) =>
          p.role === "group_lead" &&
          p.email &&
          p.client_id === client_id &&
          (p.sub_division || "General") === sub_division
      );

      const toEmails = [...new Set(groupLeads.map((p) => p.email))];
      if (!toEmails.length) {
        // Fall back: notify managers only when no group lead is mapped
        toEmails.push(...managerEmails);
      }

      const uniqueTo = [...new Set(toEmails)];
      const cc = managerEmails.filter((e) => !uniqueTo.includes(e));

      if (!uniqueTo.length) {
        await supabase.from("weekly_report_deliveries").upsert({
          week_start: start,
          week_end: end,
          client_id,
          sub_division,
          recipients: [],
          cc_recipients: [],
          deep_link: deepLink,
          summary_json: { ranked, entryCount: divEntries.length },
          status: "skipped",
          error_message: "No recipients found for division",
        }, { onConflict: "week_start,client_id,sub_division" });
        results.push({ client_id, sub_division, status: "skipped", reason: "no_recipients" });
        continue;
      }

      const topRows = ranked.slice(0, 8).map((r) =>
        `<tr><td style="padding:6px 10px;border-bottom:1px solid #eee">${r.label}</td>` +
        `<td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right">${r.score}%</td>` +
        `<td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:center">${r.band}</td></tr>`
      ).join("");

      const html = `
        <div style="font-family:Segoe UI,Arial,sans-serif;max-width:640px;margin:0 auto;color:#111">
          <h2 style="margin-bottom:4px">Weekly Performance Rating</h2>
          <p style="color:#666;margin-top:0">${client_id} · ${sub_division} · ${start} → ${end}</p>
          <p>${divEntries.length} task log(s) scored with 60% target + 40% time (Miscellaneous = hours÷8).</p>
          <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px">
            <thead>
              <tr style="background:#f5f5f5">
                <th style="text-align:left;padding:8px 10px">Performer</th>
                <th style="text-align:right;padding:8px 10px">Score</th>
                <th style="text-align:center;padding:8px 10px">Band</th>
              </tr>
            </thead>
            <tbody>${topRows || '<tr><td colspan="3" style="padding:12px">No ranked performers</td></tr>'}</tbody>
          </table>
          <p>
            <a href="${deepLink}" style="display:inline-block;background:#2563eb;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:700">
              View charts in Analytics
            </a>
          </p>
          <p style="font-size:12px;color:#888">Sign in required. Link opens Performance Rating filtered to this division and week.</p>
        </div>
      `;

      const emailRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: fromEmail,
          to: uniqueTo,
          cc: cc.length ? cc : undefined,
          subject: `CBPET Weekly Rating · ${client_id} / ${sub_division} · ${start}`,
          html,
        }),
      });

      if (!emailRes.ok) {
        const errText = await emailRes.text();
        await supabase.from("weekly_report_deliveries").upsert({
          week_start: start,
          week_end: end,
          client_id,
          sub_division,
          recipients: uniqueTo,
          cc_recipients: cc,
          deep_link: deepLink,
          summary_json: { ranked, entryCount: divEntries.length },
          status: "failed",
          error_message: errText.slice(0, 1000),
        }, { onConflict: "week_start,client_id,sub_division" });
        results.push({ client_id, sub_division, status: "failed", error: errText });
        continue;
      }

      await supabase.from("weekly_report_deliveries").upsert({
        week_start: start,
        week_end: end,
        client_id,
        sub_division,
        recipients: uniqueTo,
        cc_recipients: cc,
        deep_link: deepLink,
        summary_json: { ranked, entryCount: divEntries.length },
        status: "sent",
        error_message: null,
      }, { onConflict: "week_start,client_id,sub_division" });

      results.push({
        client_id,
        sub_division,
        status: "sent",
        recipients: uniqueTo.length,
        cc: cc.length,
      });
    }

    return new Response(JSON.stringify({ ok: true, week: { start, end }, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ ok: false, error: String(error?.message || error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
