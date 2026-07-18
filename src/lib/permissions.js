/** Active six-role hierarchy helpers for enterprise modules. */

export const ACTIVE_ROLES = [
  'performer',
  'team_lead',
  'group_lead',
  'manager',
  'general_manager',
  'super_admin',
];

export function isLeadRole(role) {
  return role === 'team_lead' || role === 'group_lead';
}

export function isManagerRole(role) {
  return role === 'manager' || role === 'general_manager' || role === 'super_admin';
}

export function isAdminRole(role) {
  return role === 'super_admin' || role === 'general_manager';
}

export function canManageUsers(role) {
  return isAdminRole(role);
}

export function canViewAllAnalytics(role) {
  return isManagerRole(role);
}

export function canManageRequestHub(role) {
  return isLeadRole(role) || isManagerRole(role);
}

export function canCloseRequestHubTicket(role) {
  return isManagerRole(role);
}

export function canViewFeedback(role) {
  return isManagerRole(role);
}

export function canViewBehaviourAnalytics(role) {
  return isLeadRole(role) || isManagerRole(role);
}

export function canUseGovernance(role) {
  return role === 'super_admin';
}

export function canAccessAdminTab(role) {
  return ['super_admin', 'general_manager', 'manager'].includes(role);
}
