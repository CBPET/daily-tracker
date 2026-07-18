/**
 * Shared scoring helpers for the weekly-performance-report Edge Function.
 * Keep in sync with src/lib/performanceRating.js
 */

export const STANDARD_WORK_HOURS = 8;
export const TARGET_WEIGHT = 0.6;
export const TIME_WEIGHT = 0.4;

export function capScore(value, max = 100) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(n, max);
}

export function scoreEntry(entry) {
  if (!entry) return 0;
  if (entry.taskType === "Miscellaneous") {
    const hours = Number(entry.takenTime);
    if (!Number.isFinite(hours) || hours <= 0) return 0;
    return Number(capScore((hours / STANDARD_WORK_HOURS) * 100).toFixed(2));
  }
  const target = capScore(entry.targetAchieved);
  const time = capScore(entry.timeAchieved);
  return Number((TARGET_WEIGHT * target + TIME_WEIGHT * time).toFixed(2));
}

export function getRatingBand(score) {
  const s = Number(score);
  if (s >= 90) return "Excellent";
  if (s >= 75) return "Good";
  return "Needs Improvement";
}

export function getPreviousWeekRange(now = new Date()) {
  const day = now.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const thisMonday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + mondayOffset);
  const prevMonday = new Date(thisMonday);
  prevMonday.setDate(thisMonday.getDate() - 7);
  const prevSunday = new Date(prevMonday);
  prevSunday.setDate(prevMonday.getDate() + 6);
  const iso = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dayNum = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${dayNum}`;
  };
  return { start: iso(prevMonday), end: iso(prevSunday) };
}

export function partitionByDivision(entries) {
  const map = {};
  for (const e of entries || []) {
    const client = e.client_id || "DEFAULT_CLIENT";
    const division = e.sub_division || "General";
    const key = `${client}||${division}`;
    if (!map[key]) map[key] = { client_id: client, sub_division: division, entries: [] };
    map[key].entries.push(e);
  }
  return Object.values(map);
}

export function aggregateByPerformer(entries) {
  const groups = {};
  for (const entry of entries || []) {
    const id = entry.user_id || entry.performerName || "unknown";
    const label = entry.performerName || id;
    const hours = Number(entry.takenTime);
    const weight = Number.isFinite(hours) && hours > 0 ? hours : 1;
    const score = scoreEntry(entry);
    if (!groups[id]) {
      groups[id] = { id, label, scoreSum: 0, weightSum: 0, count: 0 };
    }
    groups[id].scoreSum += score * weight;
    groups[id].weightSum += weight;
    groups[id].count += 1;
  }
  return Object.values(groups)
    .map((g) => {
      const score = g.weightSum > 0 ? Number((g.scoreSum / g.weightSum).toFixed(2)) : 0;
      return {
        label: g.label,
        score,
        band: getRatingBand(score),
        count: g.count,
        hours: Number(g.weightSum.toFixed(2)),
      };
    })
    .sort((a, b) => b.score - a.score);
}

export function buildAnalyticsDeepLink({
  baseUrl,
  client,
  division,
  start,
  end,
}) {
  const root = String(baseUrl || "").replace(/\/$/, "");
  const params = new URLSearchParams({
    tab: "ratings",
    period: "weekly",
    groupBy: "individual",
  });
  if (client) params.set("client", client);
  if (division) params.set("division", division);
  if (start) params.set("start", start);
  if (end) params.set("end", end);
  return `${root}/#analytics?${params.toString()}`;
}
