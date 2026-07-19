export const LONG_DELAY_DAYS = 7;

export const PERIOD_OPTIONS = [
    { key: 'week', label: 'Week', days: 7 },
    { key: 'month', label: 'Month', days: 30 },
    { key: 'quarter', label: 'Quarter', days: 90 },
    { key: 'half_year', label: 'Half year', days: 182 },
    { key: 'year', label: 'Year', days: 365 },
];

export function toDateOnly(value) {
    if (!value) return null;
    const text = String(value).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
    return text;
}

export function effectiveDueDate(row) {
    return toDateOnly(row?.revised_due_date || row?.due_date);
}

export function todayISO(now = new Date()) {
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

export function daysBetween(fromISO, toISO) {
    if (!fromISO || !toISO) return null;
    const a = new Date(`${fromISO}T00:00:00Z`);
    const b = new Date(`${toISO}T00:00:00Z`);
    return Math.round((b.getTime() - a.getTime()) / 86400000);
}

export function periodWindow(periodKey, now = new Date()) {
    const option = PERIOD_OPTIONS.find((item) => item.key === periodKey) || PERIOD_OPTIONS[1];
    const end = todayISO(now);
    const startDate = new Date(`${end}T00:00:00Z`);
    startDate.setUTCDate(startDate.getUTCDate() - (option.days - 1));
    return { start: todayISO(startDate), end, days: option.days };
}

export function isOpenTask(task) {
    const status = task?.allocation_status;
    return status !== 'completed' && status !== 'cancelled' && status !== 'skipped';
}

/**
 * Classify an open task relative to today.
 * ahead: due after today; ontime: due today; delay: due before today.
 */
export function classifyTaskTiming(task, today = todayISO()) {
    const due = effectiveDueDate(task);
    if (!due || !isOpenTask(task)) return null;
    if (due > today) return 'ahead';
    if (due === today) return 'ontime';
    return 'delay';
}

export function isTodayDue(task, today = todayISO()) {
    return isOpenTask(task) && effectiveDueDate(task) === today;
}

export function isLongDelay(task, today = todayISO(), n = LONG_DELAY_DAYS) {
    if (!isOpenTask(task)) return false;
    const due = effectiveDueDate(task);
    if (!due || due >= today) return false;
    const delay = daysBetween(due, today);
    return delay !== null && delay >= n;
}

export function isDeliveryInPeriod(task, window) {
    const completed = toDateOnly(task?.completed_date || task?.completed_from_performer);
    if (!completed) return false;
    return completed >= window.start && completed <= window.end;
}

export function taskInPeriodFocus(task, window, today = todayISO()) {
    const due = effectiveDueDate(task);
    if (due && due >= window.start && due <= window.end) return true;
    if (isDeliveryInPeriod(task, window)) return true;
    if (isLongDelay(task, today) && due && due <= window.end) return true;
    return false;
}

export function computeScheduleKpis(tasks, {
    periodKey = 'month',
    now = new Date(),
    longDelayDays = LONG_DELAY_DAYS,
} = {}) {
    const today = todayISO(now);
    const window = periodWindow(periodKey, now);
    const scoped = (tasks || []).filter((task) => taskInPeriodFocus(task, window, today) || isTodayDue(task, today) || isLongDelay(task, today, longDelayDays));

    let ontime = 0;
    let ahead = 0;
    let delay = 0;
    let todayDue = 0;
    let longDelay = 0;
    let delivery = 0;

    for (const task of tasks || []) {
        if (isTodayDue(task, today)) todayDue += 1;
        if (isLongDelay(task, today, longDelayDays)) longDelay += 1;
        if (isDeliveryInPeriod(task, window)) delivery += 1;

        const timing = classifyTaskTiming(task, today);
        if (!timing) continue;
        const due = effectiveDueDate(task);
        if (due && due >= window.start && due <= window.end) {
            if (timing === 'ontime') ontime += 1;
            if (timing === 'ahead') ahead += 1;
            if (timing === 'delay') delay += 1;
        } else if (timing === 'delay' && isLongDelay(task, today, longDelayDays)) {
            delay += 1;
        }
    }

    return {
        window,
        today,
        counts: { ontime, ahead, delay, todayDue, longDelay, delivery },
        scopedTaskIds: scoped.map((task) => task.id),
    };
}

export function filterTasksByKpi(tasks, kpiKey, options = {}) {
    const today = todayISO(options.now);
    const window = periodWindow(options.periodKey || 'month', options.now);
    const longDelayDays = options.longDelayDays ?? LONG_DELAY_DAYS;
    const list = tasks || [];

    switch (kpiKey) {
        case 'todayDue':
            return list.filter((task) => isTodayDue(task, today));
        case 'longDelay':
            return list.filter((task) => isLongDelay(task, today, longDelayDays));
        case 'delivery':
            return list.filter((task) => isDeliveryInPeriod(task, window));
        case 'ontime':
            return list.filter((task) => {
                const due = effectiveDueDate(task);
                return classifyTaskTiming(task, today) === 'ontime' && due >= window.start && due <= window.end;
            });
        case 'ahead':
            return list.filter((task) => {
                const due = effectiveDueDate(task);
                return classifyTaskTiming(task, today) === 'ahead' && due >= window.start && due <= window.end;
            });
        case 'delay':
            return list.filter((task) => {
                const timing = classifyTaskTiming(task, today);
                if (timing !== 'delay') return false;
                const due = effectiveDueDate(task);
                return (due && due >= window.start && due <= window.end) || isLongDelay(task, today, longDelayDays);
            });
        default:
            return list;
    }
}

export function reasonBreakdown(events = []) {
    const counts = {};
    for (const event of events) {
        if (event.event_type !== 'schedule_date_change' && event.event_type !== 'project_date_change') continue;
        const code = event.new_values?.reason_code || 'other';
        counts[code] = (counts[code] || 0) + 1;
    }
    return counts;
}
