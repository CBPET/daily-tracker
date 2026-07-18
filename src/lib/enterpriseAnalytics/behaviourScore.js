import { isTargetFreeTask, normalizeTaskType } from '../targetUtils';

const LATE_CUTOFF_HOUR = 20; // 8:00 PM local

/** Monday–Friday workdays between two YYYY-MM-DD dates inclusive. */
export function countExpectedWorkdays(startDate, endDate) {
  const start = parseYmd(startDate);
  const end = parseYmd(endDate);
  if (!start || !end || end < start) return 0;
  let count = 0;
  const cur = new Date(start);
  while (cur <= end) {
    const day = cur.getDay();
    if (day !== 0 && day !== 6) count += 1;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

function parseYmd(ymd) {
  if (!ymd) return null;
  const [y, m, d] = String(ymd).slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function entryWorkDate(entry) {
  return String(entry.date || '').slice(0, 10);
}

function isLateEntry(entry) {
  const created = entry.created_at || entry.createdAt;
  if (!created) return false;
  const dt = new Date(created);
  if (Number.isNaN(dt.getTime())) return false;
  return dt.getHours() > LATE_CUTOFF_HOUR || (dt.getHours() === LATE_CUTOFF_HOUR && dt.getMinutes() > 0);
}

function fillMinutes(entry) {
  const created = entry.created_at || entry.createdAt;
  const work = entryWorkDate(entry);
  if (!created || !work) return null;
  const expected = parseYmd(work);
  if (!expected) return null;
  expected.setHours(9, 0, 0, 0); // assume 9am expected start
  const submitted = new Date(created);
  const mins = (submitted - expected) / 60000;
  return Number.isFinite(mins) ? Math.max(0, mins) : null;
}

/**
 * Compute behaviour component scores for a set of status_entries in a period.
 * Completion score: average targetAchieved for non-Misc entries (0–100).
 * Accuracy: starts at 100; -10 per rejected feedback; -5 per rejected request (min 0).
 */
export function calculateBehaviourScores({
  entries = [],
  periodStart,
  periodEnd,
  rejectedFeedbackCount = 0,
  rejectedRequestCount = 0,
}) {
  const expected = countExpectedWorkdays(periodStart, periodEnd) || 1;
  const workDates = new Set(
    entries.map(entryWorkDate).filter(Boolean)
  );
  const submittedDays = [...workDates].filter((d) => {
    const dt = parseYmd(d);
    if (!dt) return false;
    const day = dt.getDay();
    return day !== 0 && day !== 6;
  }).length;

  const attendance = Math.min(100, (submittedDays / expected) * 100);
  const missed = Math.max(0, expected - submittedDays);

  const lateCount = entries.filter(isLateEntry).length;
  const timeliness = entries.length
    ? Math.max(0, 100 - (lateCount / entries.length) * 100)
    : 100;

  // Consistency: ratio of weeks with at least one entry among weeks in range
  const weeks = weekKeysInRange(periodStart, periodEnd);
  const weeksWithEntry = new Set(
    entries.map((e) => weekKey(entryWorkDate(e))).filter(Boolean)
  );
  const consistency = weeks.length
    ? Math.min(100, (weeksWithEntry.size / weeks.length) * 100)
    : attendance;

  const productivityEntries = entries.filter((e) => !isTargetFreeTask(normalizeTaskType(e.taskType || e.task_type)));
  const completion = productivityEntries.length
    ? productivityEntries.reduce((s, e) => s + Number(e.targetAchieved || e.target_achieved || 0), 0) /
      productivityEntries.length
    : 0;

  const accuracy = Math.max(
    0,
    100 - rejectedFeedbackCount * 10 - rejectedRequestCount * 5
  );

  const fillVals = entries.map(fillMinutes).filter((v) => v != null);
  const averageFill =
    fillVals.length ? fillVals.reduce((a, b) => a + b, 0) / fillVals.length : 0;

  const overall =
    attendance * 0.25 +
    consistency * 0.25 +
    timeliness * 0.2 +
    Math.min(100, completion) * 0.2 +
    accuracy * 0.1;

  return {
    daily_entry_percent: round(attendance),
    weekly_entry_percent: round(consistency),
    bi_weekly_entry_percent: round(consistency),
    monthly_entry_percent: round(attendance),
    missed_entries: missed,
    late_entries: lateCount,
    average_fill_time_minutes: round(averageFill),
    entry_consistency: round(consistency),
    attendance_score: round(attendance),
    consistency_score: round(consistency),
    timeliness_score: round(timeliness),
    completion_score: round(Math.min(100, completion)),
    accuracy_score: round(accuracy),
    overall_score: round(overall),
  };
}

function weekKey(ymd) {
  const d = parseYmd(ymd);
  if (!d) return null;
  const day = d.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() + mondayOffset);
  return monday.toISOString().slice(0, 10);
}

function weekKeysInRange(start, end) {
  const keys = [];
  const s = parseYmd(start);
  const e = parseYmd(end);
  if (!s || !e) return keys;
  const cur = new Date(s);
  const seen = new Set();
  while (cur <= e) {
    const k = weekKey(
      `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`
    );
    if (k && !seen.has(k)) {
      seen.add(k);
      keys.push(k);
    }
    cur.setDate(cur.getDate() + 1);
  }
  return keys;
}

function round(n) {
  return Math.round(Number(n) * 100) / 100;
}

export { LATE_CUTOFF_HOUR, normalizeTaskType };
