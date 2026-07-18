import {
  canCloseRequestHubTicket,
  canManageRequestHub,
  isManagerRole,
} from '../permissions';

export const REQUEST_STATUSES = [
  'Request',
  'Verified',
  'Assigned',
  'In Progress',
  'Need Information',
  'Resolved',
  'Rejected',
  'Closed',
];

export const TERMINAL_STATUSES = ['Rejected', 'Closed'];

/**
 * UX-only action availability. RLS remains source of truth.
 */
export function getAvailableRequestActions(ticket, profile) {
  if (!ticket || !profile) return [];
  if (ticket.archived_at) return [];

  const role = profile.role;
  const actions = [];
  const isCreator = ticket.created_by === profile.id;
  const isAssignee = ticket.assigned_to === profile.id;
  const canManage = canManageRequestHub(role);
  const status = ticket.status;

  if (TERMINAL_STATUSES.includes(status)) {
    if (canCloseRequestHubTicket(role) && status === 'Resolved') {
      // already closed path handled below
    }
    return actions;
  }

  if (canManage && status === 'Request') {
    actions.push('approve', 'reject', 'need_information', 'assign', 'change_priority', 'add_remark');
  }

  if (canManage && ['Verified', 'Need Information'].includes(status)) {
    actions.push('assign', 'reject', 'need_information', 'change_priority', 'add_remark');
  }

  if (canManage && ['Assigned', 'In Progress'].includes(status)) {
    actions.push('reassign', 'change_priority', 'add_remark');
  }

  if ((isAssignee || isManagerRole(role)) && status === 'Assigned') {
    actions.push('start_work');
  }

  if ((isAssignee || isManagerRole(role)) && ['Assigned', 'In Progress'].includes(status)) {
    actions.push('mark_resolved');
  }

  if (canCloseRequestHubTicket(role) && status === 'Resolved') {
    actions.push('close');
  }

  if (isCreator && status === 'Need Information') {
    actions.push('add_information');
  }

  if (canManage && !actions.includes('add_remark')) {
    actions.push('add_remark');
  }

  return [...new Set(actions)];
}

export function getNextStatusForRequestAction(action, ticket) {
  switch (action) {
    case 'approve':
      return 'Verified';
    case 'reject':
      return 'Rejected';
    case 'need_information':
      return 'Need Information';
    case 'assign':
    case 'reassign':
      return 'Assigned';
    case 'start_work':
      return 'In Progress';
    case 'mark_resolved':
      return 'Resolved';
    case 'close':
      return 'Closed';
    case 'add_information':
      return ticket?.status === 'Need Information' ? 'Request' : ticket?.status;
    default:
      return ticket?.status;
  }
}

export function canViewRequest(ticket, profile) {
  if (!ticket || !profile) return false;
  if (isManagerRole(profile.role)) return true;
  if (ticket.created_by === profile.id || ticket.assigned_to === profile.id) return true;
  return canManageRequestHub(profile.role);
}

export function canAssignRequest(ticket, profile) {
  return canManageRequestHub(profile?.role);
}

export function canCloseRequest(ticket, profile) {
  return canCloseRequestHubTicket(profile?.role);
}
