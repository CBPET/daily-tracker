import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LATE_CUTOFF_HOUR = 20;

function parseYmd(ymd: string) {
  const [y, m, d] = String(ymd).slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(Date.UTC(y, m - 1, d));
}

function countExpectedWorkdays(startDate: string, endDate: string) {
  const start = parseYmd(startDate);
  const end = parseYmd(endDate);
  if (!start || !end || end < start) return 0;
  let count = 0;
  const cur = new Date(start);
  while (cur <= end) {
    const day = cur.getUTCDay();
    if (day !== 0 && day !== 6) count += 1;
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return count;
}

function calculateScores(entries: any[], periodStart: string, periodEnd: string) {
  const expected = countExpectedWorkdays(periodStart, periodEnd) || 1;
  const workDates = new Set(entries.map((e) => String(e.date || "").slice(0, 10)).filter(Boolean));
  let submittedDays = 0;
  for (const d of workDates) {
    const dt = parseYmd(d);
    if (!dt) continue;
    const day = dt.getUTCDay();
    if (day !== 0 && day !== 6) submittedDays += 1;
  }
  const attendance = Math.min(100, (submittedDays / expected) * 100);
  const missed = Math.max(0, expected - submittedDays);
  const lateCount = entries.filter((e) => {
    if (!e.created_at) return false;
    const h = new Date(e.created_at).getUTCHours();
    return h >= LATE_CUTOFF_HOUR;
  }).length;
  const timeliness = entries.length ? Math.max(0, 100 - (lateCount / entries.length) * 100) : 100;
  const consistency = attendance;
  const prod = entries.filter((e) => e.taskType !== "Miscellaneous");
  const completion = prod.length
    ? prod.reduce((s, e) => s + Number(e.targetAchieved || 0), 0) / prod.length
    : 0;
  const accuracy = 100;
  const overall =
    attendance * 0.25 + consistency * 0.25 + timeliness * 0.2 + Math.min(100, completion) * 0.2 + accuracy * 0.1;
  const round = (n: number) => Math.round(n * 100) / 100;
  return {
    daily_entry_percent: round(attendance),
    weekly_entry_percent: round(consistency),
    bi_weekly_entry_percent: round(consistency),
    monthly_entry_percent: round(attendance),
    missed_entries: missed,
    late_entries: lateCount,
    average_fill_time_minutes: 0,
    entry_consistency: round(consistency),
    attendance_score: round(attendance),
    consistency_score: round(consistency),
    timeliness_score: round(timeliness),
    completion_score: round(Math.min(100, completion)),
    accuracy_score: accuracy,
    overall_score: round(overall),
  };
}

function weekRange(ref = new Date()) {
  const day = ref.getUTCDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), ref.getUTCDate() + mondayOffset));
  const sunday = new Date(Date.UTC(monday.getUTCFullYear(), monday.getUTCMonth(), monday.getUTCDate() + 6));
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { start: fmt(monday), end: fmt(sunday) };
}

function monthRange(ref = new Date()) {
  const start = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), 1));
  const end = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth() + 1, 0));
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!supabaseUrl || !serviceKey) throw new Error("Missing Supabase credentials");

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const body = await req.json().catch(() => ({}));
    const periodType = body.period_type === "monthly" ? "monthly" : "weekly";
    const range = periodType === "monthly" ? monthRange() : weekRange();
    const periodStart = body.period_start || range.start;
    const periodEnd = body.period_end || range.end;

    const { data: profiles, error: pErr } = await admin.from("profiles").select("id");
    if (pErr) throw pErr;

    const { data: entries, error: eErr } = await admin
      .from("status_entries")
      .select("*")
      .gte("date", periodStart)
      .lte("date", periodEnd);
    if (eErr) throw eErr;

    let upserted = 0;
    for (const profile of profiles || []) {
      const userEntries = (entries || []).filter((e) => e.user_id === profile.id);
      const scores = calculateScores(userEntries, periodStart, periodEnd);
      const row = {
        user_id: profile.id,
        period_type: periodType,
        period_start: periodStart,
        period_end: periodEnd,
        client_id: null,
        team_id: null,
        ...scores,
        calculated_at: new Date().toISOString(),
        metadata: { source: "calculate-behaviour-snapshots" },
      };

      // Delete existing global snapshot then insert (partial unique)
      await admin
        .from("user_behaviour_snapshots")
        .delete()
        .eq("user_id", profile.id)
        .eq("period_type", periodType)
        .eq("period_start", periodStart)
        .eq("period_end", periodEnd)
        .is("client_id", null)
        .is("team_id", null);

      const { error } = await admin.from("user_behaviour_snapshots").insert(row);
      if (error) throw error;
      upserted += 1;
    }

    return new Response(
      JSON.stringify({ ok: true, upserted, period_type: periodType, period_start: periodStart, period_end: periodEnd }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: err.message || String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
