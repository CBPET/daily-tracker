import {
    STANDARD_WORK_HOURS_PER_DAY,
    isTargetFreeTask,
    getLocalISODate,
} from './targetUtils.js';

export const TARGET_WEIGHT = 0.6;
export const TIME_WEIGHT = 0.4;

export const RATING_BANDS = [
    { id: 'excellent', label: 'Excellent', min: 90, max: 100 },
    { id: 'good', label: 'Good', min: 75, max: 89.99 },
    { id: 'needs_improvement', label: 'Needs Improvement', min: 0, max: 74.99 },
];

export function capScore(value, max = 100) {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0) return 0;
    return Math.min(n, max);
}

/** Miscellaneous: (takenHours / 8) × 100, capped at 100 */
export function scoreMiscellaneous(takenHours) {
    const hours = Number(takenHours);
    if (!Number.isFinite(hours) || hours <= 0) return 0;
    return Number(capScore((hours / STANDARD_WORK_HOURS_PER_DAY) * 100).toFixed(2));
}

/** Standard tasks: 60% target + 40% time efficiency, both capped */
export function scoreComposite(targetAchieved, timeEfficiency) {
    const target = capScore(targetAchieved);
    const time = capScore(timeEfficiency);
    return Number((TARGET_WEIGHT * target + TIME_WEIGHT * time).toFixed(2));
}

export function scoreEntry(entry) {
    if (!entry) return 0;
    if (isTargetFreeTask(entry.taskType) || entry.taskType === 'Miscellaneous') {
        return scoreMiscellaneous(entry.takenTime);
    }
    return scoreComposite(entry.targetAchieved, entry.timeAchieved);
}

export function getRatingBand(score) {
    const s = Number(score);
    if (!Number.isFinite(s)) return RATING_BANDS[2];
    if (s >= 90) return RATING_BANDS[0];
    if (s >= 75) return RATING_BANDS[1];
    return RATING_BANDS[2];
}

export function filterEntriesByPeriod(entries, { mode, key, start, end } = {}) {
    if (!entries?.length) return [];
    if (start && end) {
        return entries.filter((e) => e.date >= start && e.date <= end);
    }
    if (!mode || !key) return [...entries];

    if (mode === 'monthly') {
        return entries.filter((e) => typeof e.date === 'string' && e.date.startsWith(key));
    }
    if (mode === 'yearly') {
        return entries.filter((e) => typeof e.date === 'string' && e.date.startsWith(key));
    }
    if (mode === 'quarterly') {
        // key = YYYY-Qn
        const match = /^(\d{4})-Q([1-4])$/.exec(key);
        if (!match) return [];
        const year = match[1];
        const q = Number(match[2]);
        const startMonth = (q - 1) * 3 + 1;
        const endMonth = startMonth + 2;
        return entries.filter((e) => {
            if (!e.date || !e.date.startsWith(year)) return false;
            const month = Number(e.date.slice(5, 7));
            return month >= startMonth && month <= endMonth;
        });
    }
    if (mode === 'weekly' && start && end) {
        return entries.filter((e) => e.date >= start && e.date <= end);
    }
    return [...entries];
}

export function listAvailablePeriods(entries) {
    const months = new Set();
    const quarters = new Set();
    const years = new Set();

    (entries || []).forEach((e) => {
        if (!e?.date || e.date.length < 7) return;
        const year = e.date.slice(0, 4);
        const month = e.date.slice(0, 7);
        const m = Number(e.date.slice(5, 7));
        if (!year || Number.isNaN(m)) return;
        years.add(year);
        months.add(month);
        const q = Math.floor((m - 1) / 3) + 1;
        quarters.add(`${year}-Q${q}`);
    });

    const sortDesc = (a, b) => b.localeCompare(a);
    return {
        monthly: [...months].sort(sortDesc),
        quarterly: [...quarters].sort(sortDesc),
        yearly: [...years].sort(sortDesc),
    };
}

function resolveGroupKey(entry, groupBy, profileMap = {}) {
    if (groupBy === 'process') {
        return {
            id: entry.taskType || 'Unknown',
            label: entry.taskType || 'Unknown',
        };
    }
    if (groupBy === 'team') {
        const profile = profileMap[entry.user_id] || profileMap[entry.performerName];
        const teamId = profile?.team_id || entry.team_id || 'unassigned';
        const teamName = profile?.team_name || entry.team_name || (teamId === 'unassigned' ? 'Unassigned' : teamId);
        return { id: String(teamId), label: teamName };
    }
    // individual
    const profile = profileMap[entry.user_id];
    const id = entry.user_id || entry.performerName || 'unknown';
    const label = profile?.performer_name || entry.performerName || 'Unknown';
    return { id: String(id), label };
}

/**
 * Hour-weighted aggregation by individual | team | process.
 * @param {Array} entries
 * @param {'individual'|'team'|'process'} groupBy
 * @param {Record<string, object>} profileMap keyed by user_id (and optionally performerName)
 */
export function aggregatePerformanceRatings(entries, groupBy = 'individual', profileMap = {}) {
    const groups = {};

    (entries || []).forEach((entry) => {
        const { id, label } = resolveGroupKey(entry, groupBy, profileMap);
        const hours = Number(entry.takenTime);
        const weight = Number.isFinite(hours) && hours > 0 ? hours : 1;
        const score = scoreEntry(entry);
        const isMisc = isTargetFreeTask(entry.taskType);

        if (!groups[id]) {
            groups[id] = {
                id,
                label,
                scoreSum: 0,
                weightSum: 0,
                count: 0,
                miscCount: 0,
                targetSum: 0,
                timeSum: 0,
                scoredWeight: 0,
                client_id: entry.client_id || null,
                sub_division: entry.sub_division || null,
            };
        }

        const g = groups[id];
        g.scoreSum += score * weight;
        g.weightSum += weight;
        g.count += 1;
        if (isMisc) g.miscCount += 1;
        else {
            g.targetSum += Number(entry.targetAchieved || 0) * weight;
            g.timeSum += Number(entry.timeAchieved || 0) * weight;
            g.scoredWeight += weight;
        }
    });

    const rows = Object.values(groups).map((g) => {
        const score = g.weightSum > 0 ? Number((g.scoreSum / g.weightSum).toFixed(2)) : 0;
        const band = getRatingBand(score);
        const avgTarget = g.scoredWeight > 0 ? Number((g.targetSum / g.scoredWeight).toFixed(2)) : null;
        const avgTime = g.scoredWeight > 0 ? Number((g.timeSum / g.scoredWeight).toFixed(2)) : null;
        return {
            id: g.id,
            label: g.label,
            score,
            band: band.id,
            bandLabel: band.label,
            count: g.count,
            miscCount: g.miscCount,
            totalHours: Number(g.weightSum.toFixed(2)),
            avgTarget,
            avgTime,
            client_id: g.client_id,
            sub_division: g.sub_division,
        };
    });

    rows.sort((a, b) => b.score - a.score || a.label.localeCompare(b.label));
    return rows.map((row, index) => ({ ...row, rank: index + 1 }));
}

export function buildRatingSuggestions(rows) {
    return (rows || [])
        .filter((r) => r.score < 75)
        .slice(0, 5)
        .map((r) => {
            const tips = [];
            if (r.avgTarget != null && r.avgTarget < 100) {
                tips.push('raise target achievement toward 100%');
            }
            if (r.avgTime != null && r.avgTime < 100) {
                tips.push('improve time efficiency (taken ≤ estimated)');
            }
            if (r.miscCount > 0 && r.miscCount === r.count) {
                tips.push('Miscellaneous score is hours÷8; log productive tasks when possible');
            }
            if (!tips.length) tips.push('review workload mix and delays');
            return {
                id: r.id,
                label: r.label,
                score: r.score,
                bandLabel: r.bandLabel,
                message: `${r.label} is at ${r.score}% (${r.bandLabel}). Focus: ${tips.join('; ')}.`,
            };
        });
}

export function summarizeBandDistribution(rows) {
    const dist = {
        excellent: 0,
        good: 0,
        needs_improvement: 0,
    };
    (rows || []).forEach((r) => {
        if (dist[r.band] != null) dist[r.band] += 1;
    });
    return dist;
}

/** Previous complete Monday–Sunday week relative to `now` */
export function getPreviousWeekRange(now = new Date()) {
    const day = now.getDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    const thisMonday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + mondayOffset);
    const prevMonday = new Date(thisMonday);
    prevMonday.setDate(thisMonday.getDate() - 7);
    const prevSunday = new Date(prevMonday);
    prevSunday.setDate(prevMonday.getDate() + 6);
    return {
        start: getLocalISODate(prevMonday),
        end: getLocalISODate(prevSunday),
    };
}

export function buildAnalyticsDeepLink({
    baseUrl,
    tab = 'ratings',
    period = 'weekly',
    client,
    division,
    start,
    end,
    groupBy = 'individual',
}) {
    const root = (baseUrl || '').replace(/\/$/, '');
    const params = new URLSearchParams();
    params.set('tab', tab);
    if (period) params.set('period', period);
    if (client) params.set('client', client);
    if (division) params.set('division', division);
    if (start) params.set('start', start);
    if (end) params.set('end', end);
    if (groupBy) params.set('groupBy', groupBy);
    return `${root}/#analytics?${params.toString()}`;
}

export function parseAnalyticsHash(hash = '') {
    const raw = String(hash).replace(/^#/, '');
    const [pathPart, queryPart] = raw.split('?');
    const params = Object.fromEntries(new URLSearchParams(queryPart || ''));
    return {
        path: pathPart || '',
        tab: params.tab || null,
        period: params.period || null,
        client: params.client || null,
        division: params.division || null,
        start: params.start || null,
        end: params.end || null,
        groupBy: params.groupBy || null,
    };
}

/**
 * Partition entries by client + sub_division for weekly division reports.
 */
export function partitionByDivision(entries) {
    const map = {};
    (entries || []).forEach((e) => {
        const client = e.client_id || 'DEFAULT_CLIENT';
        const division = e.sub_division || 'General';
        const key = `${client}||${division}`;
        if (!map[key]) {
            map[key] = { client_id: client, sub_division: division, entries: [] };
        }
        map[key].entries.push(e);
    });
    return Object.values(map);
}

export function buildProfileMap(profiles = []) {
    const map = {};
    profiles.forEach((p) => {
        if (p?.id) map[p.id] = p;
        if (p?.performer_name) map[p.performer_name] = p;
    });
    return map;
}
