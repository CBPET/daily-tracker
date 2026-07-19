export const SCHEDULE_DATE_REASON_CODES = [
    { code: 'availability', label: 'Availability' },
    { code: 'priority', label: 'Priority change' },
    { code: 'leave', label: 'Leave' },
    { code: 'workload_delay', label: 'Workload delay' },
    { code: 'client_change', label: 'Client change' },
    { code: 'other', label: 'Other' },
];

export const SCHEDULE_DATE_FIELDS = [
    'due_date',
    'revised_due_date',
    'due_from_performer',
    'completed_date',
    'completed_from_performer',
];

export const PROJECT_DATE_FIELDS = [
    'due_date',
    'revised_due_date',
    'login_date',
    'revised_login_date',
];

export function isDateFieldPatch(patch = {}) {
    return Object.keys(patch).some((key) => SCHEDULE_DATE_FIELDS.includes(key));
}

export function pickDateValues(row = {}, fields = SCHEDULE_DATE_FIELDS) {
    return fields.reduce((acc, key) => {
        if (row[key] !== undefined) acc[key] = row[key] ?? null;
        return acc;
    }, {});
}

/**
 * Insert a project_schedule_events row (append-only audit).
 */
export async function logScheduleEvent({
    supabase,
    projectId,
    scheduleTaskId = null,
    eventType,
    oldValues = {},
    newValues = {},
    note = null,
    reasonCode = null,
    userId = null,
}) {
    const payload = {
        project_id: projectId,
        schedule_task_id: scheduleTaskId,
        event_type: eventType,
        old_values: oldValues,
        new_values: {
            ...newValues,
            ...(reasonCode ? { reason_code: reasonCode } : {}),
        },
        note: note || null,
        reason_code: reasonCode || null,
        created_by: userId,
    };
    const { data, error } = await supabase
        .from('project_schedule_events')
        .insert([payload])
        .select()
        .single();
    if (error) throw error;
    return data;
}

export async function fetchScheduleEvents(supabase, { projectId = null, limit = 100 } = {}) {
    let query = supabase
        .from('project_schedule_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);
    if (projectId) query = query.eq('project_id', projectId);
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
}

export function reasonLabel(code) {
    return SCHEDULE_DATE_REASON_CODES.find((item) => item.code === code)?.label || code || '—';
}
