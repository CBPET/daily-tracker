import { supabase } from '../supabase';
import { calculateBehaviourScores } from './behaviourScore';
import { normalizeTaskType } from '../targetUtils';

const LIST_LIMIT = 50;

export async function getBehaviourSnapshots({ userId, periodType, limit = LIST_LIMIT } = {}) {
  let query = supabase
    .from('user_behaviour_snapshots')
    .select('*')
    .is('client_id', null)
    .is('team_id', null)
    .order('period_start', { ascending: false })
    .limit(limit);

  if (userId) query = query.eq('user_id', userId);
  if (periodType) query = query.eq('period_type', periodType);

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function computeLiveBehaviourForUser(userId, periodStart, periodEnd, entries) {
  const userEntries = (entries || []).filter((e) => e.user_id === userId);
  let rejectedFeedbackCount = 0;
  let rejectedRequestCount = 0;
  try {
    const { count: fb } = await supabase
      .from('feedback_records')
      .select('*', { count: 'exact', head: true })
      .eq('performer_id', userId)
      .eq('severity', 'Critical')
      .is('archived_at', null)
      .gte('feedback_date', periodStart)
      .lte('feedback_date', periodEnd);
    rejectedFeedbackCount = fb || 0;
  } catch {
    /* table may not exist yet */
  }
  try {
    const { count: rq } = await supabase
      .from('request_hub_tickets')
      .select('*', { count: 'exact', head: true })
      .eq('created_by', userId)
      .eq('status', 'Rejected')
      .gte('created_date', periodStart)
      .lte('created_date', `${periodEnd}T23:59:59`);
    rejectedRequestCount = rq || 0;
  } catch {
    /* ignore */
  }

  return calculateBehaviourScores({
    entries: userEntries,
    periodStart,
    periodEnd,
    rejectedFeedbackCount,
    rejectedRequestCount,
  });
}

export async function getRequestHubContributionMetrics({ start, end, limit = LIST_LIMIT } = {}) {
  let query = supabase
    .from('request_hub_tickets')
    .select('id, created_by, category, status, created_date, closed_date, assigned_to, client_id')
    .is('archived_at', null)
    .order('created_date', { ascending: false })
    .limit(200);

  if (start) query = query.gte('created_date', start);
  if (end) query = query.lte('created_date', `${end}T23:59:59`);

  const { data, error } = await query;
  if (error) throw error;
  const tickets = data || [];

  const byUser = {};
  for (const t of tickets) {
    const uid = t.created_by;
    if (!uid) continue;
    if (!byUser[uid]) {
      byUser[uid] = {
        user_id: uid,
        bugs: 0,
        improvements: 0,
        features: 0,
        enhancements: 0,
        resolved: 0,
        rejected: 0,
        total: 0,
      };
    }
    const row = byUser[uid];
    row.total += 1;
    if (t.category === 'Bug') row.bugs += 1;
    if (t.category === 'Improvement') row.improvements += 1;
    if (t.category === 'Feature Update') row.features += 1;
    if (t.category === 'Enhancement') row.enhancements += 1;
    if (t.status === 'Resolved' || t.status === 'Closed') row.resolved += 1;
    if (t.status === 'Rejected') row.rejected += 1;
  }

  return Object.values(byUser)
    .filter((r) => r.total >= 1)
    .sort((a, b) => b.total - a.total)
    .slice(0, limit);
}

export async function getDelayedRequestHubTickets({ olderThanDays = 7, limit = LIST_LIMIT } = {}) {
  const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('request_hub_tickets')
    .select('*')
    .is('archived_at', null)
    .not('status', 'in', '("Resolved","Rejected","Closed")')
    .lt('created_date', cutoff)
    .order('created_date', { ascending: true })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

export function buildHeatmapCells(entries, dimension = 'taskType') {
  const map = {};
  for (const e of entries || []) {
    let key = 'Unknown';
    if (dimension === 'taskType') key = normalizeTaskType(e.taskType || e.task_type) || 'Unknown';
    else if (dimension === 'client') key = e.client_id || 'Unknown';
    else if (dimension === 'sub_division') key = e.sub_division || 'Unknown';
    else if (dimension === 'user') key = e.user_id || e.performerName || 'Unknown';
    if (!map[key]) map[key] = { key, count: 0, late: 0, missedProxy: 0 };
    map[key].count += 1;
    const created = e.created_at;
    if (created) {
      const h = new Date(created).getHours();
      if (h >= 20) map[key].late += 1;
    }
  }
  return Object.values(map).sort((a, b) => b.count - a.count);
}

export function teamHealthScore({ avgBehaviour = 0, resolutionHealth = 0, entryCoverage = 0 }) {
  return Math.round(avgBehaviour * 0.5 + resolutionHealth * 0.25 + entryCoverage * 0.25);
}
