import { PROJECT_MANAGER_ROLES } from './projectFieldConfig.js';

export const PROJECT_CONFIG_EDITOR_ROLES = ['super_admin', 'general_manager', 'manager'];

/** Roles allowed to edit schedule/project due dates (matches SQL can_manage_project_database). */
export const PROJECT_DATE_EDITOR_ROLES = PROJECT_MANAGER_ROLES;

export function canManageProjectDatabase(profile) {
    return PROJECT_MANAGER_ROLES.includes(profile?.role);
}

export function canEditProjectFieldConfig(profile) {
    return PROJECT_CONFIG_EDITOR_ROLES.includes(profile?.role);
}

export function canEditProjectScheduleDates(profile) {
    return PROJECT_DATE_EDITOR_ROLES.includes(profile?.role);
}

export function canUpdateScheduleTask(task, session, canManage) {
    if (canManage) return true;
    return Boolean(task?.assigned_to && session?.user?.id && task.assigned_to === session.user.id);
}

/**
 * Filter schedule tasks visible for dashboard / scope by role hierarchy.
 * Performer: assigned to me. Leads/managers: all tasks passed in (RLS already scoped).
 */
export function filterTasksForRole(tasks, profile, session) {
    const list = Array.isArray(tasks) ? tasks : [];
    if (!profile || !session?.user?.id) return [];
    if (canManageProjectDatabase(profile)) return list;
    return list.filter((task) => task.assigned_to === session.user.id);
}

export function filterProjectsForTasks(projects, tasks) {
    const projectIds = new Set((tasks || []).map((task) => task.project_id));
    return (projects || []).filter((project) => projectIds.has(project.id));
}

export function dashboardRoleTier(profile) {
    const role = profile?.role;
    if (['super_admin', 'general_manager', 'manager'].includes(role)) return 'manager';
    if (['group_lead', 'team_lead'].includes(role)) return 'lead';
    return 'performer';
}
