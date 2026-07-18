export const STANDARD_TARGETS = {
    Prestyle: 900,
    Preedit: 300,
    'FL Validation': 600, // historical alias — prefer FP Validation for new data
    'FP Validation': 600,
    'Revises Validation': 1200,
    Normalisation: 300,
    'Cast-off XML Conversion': 4,
    'Ref Edit': 400,
    'Style Editing': 80,
};

export const TARGET_UNITS = {
    Prestyle: 'pages/day',
    Preedit: 'pages/day',
    'FL Validation': 'pages/day',
    'FP Validation': 'pages/day',
    'Revises Validation': 'pages/day',
    Normalisation: 'pages/day',
    'Cast-off XML Conversion': 'titles/day',
    'Ref Edit': 'refs/day',
    'Style Editing': 'pages/day',
    Miscellaneous: 'hours',
};

export const STANDARD_WORK_HOURS_PER_DAY = 8;

export const TARGET_FREE_TASKS = new Set(['Miscellaneous']);

export const TARGET_INFO_ROWS = [
    { taskType: 'Prestyle', target: 900, unit: 'pages/day', formula: 'Completed × 8 ÷ 900', example: '450 × 8 ÷ 900 = 4h' },
    { taskType: 'Preedit', target: 300, unit: 'pages/day', formula: 'Completed × 8 ÷ 300', example: '150 × 8 ÷ 300 = 4h' },
    { taskType: 'FP Validation', target: 600, unit: 'pages/day', formula: 'Completed × 8 ÷ 600', example: '300 × 8 ÷ 600 = 4h' },
    { taskType: 'Revises Validation', target: 1200, unit: 'pages/day', formula: 'Completed × 8 ÷ 1200', example: '600 × 8 ÷ 1200 = 4h' },
    { taskType: 'Normalisation', target: 300, unit: 'pages/day', formula: 'Completed × 8 ÷ 300', example: '150 × 8 ÷ 300 = 4h' },
    { taskType: 'Cast-off XML Conversion', target: 4, unit: 'titles/day', formula: 'Completed × 8 ÷ 4', example: '2 × 8 ÷ 4 = 4h' },
    { taskType: 'Ref Edit', target: 400, unit: 'refs/day', formula: 'Completed × 8 ÷ 400', example: '200 × 8 ÷ 400 = 4h' },
    { taskType: 'Style Editing', target: 80, unit: 'pages/day', formula: 'Completed × 8 ÷ 80', example: '40 × 8 ÷ 80 = 4h' },
    { taskType: 'Miscellaneous', target: null, unit: 'hours', formula: 'Manual only', example: '1-4h allowed' },
];

/** Canonicalize task labels so FL Validation aggregates with FP Validation. */
export function normalizeTaskType(taskType) {
    if (taskType === 'FL Validation') return 'FP Validation';
    return taskType || '';
}

export function isTargetFreeTask(taskType) {
    return TARGET_FREE_TASKS.has(taskType);
}

export function calcEstimatedHours(taskType, completedWork, dailyTarget) {
    if (isTargetFreeTask(taskType)) return 0;
    const work = Number(completedWork);
    const target = Number(dailyTarget);
    if (!Number.isFinite(work) || !Number.isFinite(target) || work <= 0 || target <= 0) return 0;
    return Number(((work * STANDARD_WORK_HOURS_PER_DAY) / target).toFixed(2));
}

export function calcTargetAchievement(taskType, completedPages, takenTime) {
    if (isTargetFreeTask(taskType)) return 0;
    const canonical = normalizeTaskType(taskType);
    const target = STANDARD_TARGETS[canonical] ?? STANDARD_TARGETS[taskType];
    if (!target || !takenTime || !completedPages) return 0;
    return ((completedPages / ((target / STANDARD_WORK_HOURS_PER_DAY) * takenTime)) * 100).toFixed(2);
}

export function calcTimeEfficiency(estimatedTime, takenTime) {
    if (!estimatedTime || !takenTime) return 0;
    return ((estimatedTime / takenTime) * 100).toFixed(2);
}

/** Monday-start week boundaries as local YYYY-MM-DD strings */
export function getLocalISODate(date = new Date()) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

export function getCurrentWeekRange(now = new Date()) {
    const day = now.getDay(); // 0 Sun … 6 Sat
    const mondayOffset = day === 0 ? -6 : 1 - day;
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + mondayOffset);
    const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
    return { start: getLocalISODate(monday), end: getLocalISODate(sunday) };
}

export function getCurrentMonthPrefix(now = new Date()) {
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
}

/**
 * Weighted averages for a period.
 * Target achievement excludes target-free tasks (e.g. Miscellaneous);
 * time efficiency and count include all entries.
 */
export function aggregateDayMetrics(entries) {
    if (!entries.length) {
        return { avgTarget: 0, avgTime: 0, count: 0 };
    }

    const targetEntries = entries.filter((e) => !isTargetFreeTask(e.taskType));
    const targetHours = targetEntries.reduce((acc, e) => acc + Number(e.takenTime || 1), 0);
    const avgTarget = targetHours > 0
        ? targetEntries.reduce((acc, e) => acc + Number(e.targetAchieved || 0) * Number(e.takenTime || 1), 0) / targetHours
        : 0;

    const totalHours = entries.reduce((acc, e) => acc + Number(e.takenTime || 1), 0);
    const avgTime = totalHours > 0
        ? entries.reduce((acc, e) => acc + Number(e.timeAchieved || 0) * Number(e.takenTime || 1), 0) / totalHours
        : 0;

    return {
        avgTarget: avgTarget.toFixed(2),
        avgTime: avgTime.toFixed(2),
        count: entries.length,
    };
}

/**
 * Delay-based target correction suggestions.
 * Groups delayed entries by taskType + client + subdivision.
 * Suggests lower target when average delay exceeds 20%.
 */
export function buildTargetSuggestions(entries, getTargetForEntry) {
    const delayed = entries.filter(
        (e) =>
            !isTargetFreeTask(e.taskType) &&
            Number(e.estimatedTime) > 0 &&
            Number(e.takenTime) > Number(e.estimatedTime)
    );

    const groups = {};
    delayed.forEach((e) => {
        const client = e.client_id || 'DEFAULT_CLIENT';
        const subDiv = e.sub_division || '';
        const key = `${e.taskType}||${client}||${subDiv}`;
        if (!groups[key]) {
            groups[key] = {
                taskType: e.taskType,
                client_id: client,
                sub_division: subDiv,
                delayPctSum: 0,
                count: 0,
            };
        }
        const delay = Number(e.takenTime) - Number(e.estimatedTime);
        const delayPct = (delay / Number(e.estimatedTime)) * 100;
        groups[key].delayPctSum += delayPct;
        groups[key].count += 1;
    });

    return Object.values(groups)
        .map((g) => {
            const avgDelayPct = g.delayPctSum / g.count;
            const currentTarget = typeof getTargetForEntry === 'function'
                ? Number(getTargetForEntry(g.taskType, g.client_id, g.sub_division) || 0)
                : Number(STANDARD_TARGETS[g.taskType] || 0);
            const suggestedTarget =
                avgDelayPct > 20 && currentTarget > 0
                    ? Math.round(currentTarget * (1 - avgDelayPct / 100))
                    : null;
            return {
                taskType: g.taskType,
                client_id: g.client_id,
                sub_division: g.sub_division,
                count: g.count,
                avgDelayPercent: avgDelayPct.toFixed(1),
                currentTarget,
                suggestedTarget,
            };
        })
        .filter((s) => s.suggestedTarget != null)
        .sort((a, b) => Number(b.avgDelayPercent) - Number(a.avgDelayPercent));
}
