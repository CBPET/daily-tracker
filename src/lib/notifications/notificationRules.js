import { supabase } from '../supabase';
import { sendNotification } from './notificationService';
import { isNotificationsEnabled } from '../featureFlags';

const MODULE = 'smart_request_hub';

async function findLeadsForTicket(ticket) {
  const receivers = new Set();
  if (ticket.client_ref) {
    let q = supabase
      .from('profiles')
      .select('id, role')
      .eq('client_ref', ticket.client_ref)
      .in('role', ['group_lead', 'team_lead', 'manager', 'general_manager', 'super_admin']);
    if (ticket.sub_division) {
      // group leads may be subdivision-scoped; managers/GMs still included via broader query below
    }
    const { data } = await q;
    (data || []).forEach((p) => receivers.add(p.id));
  }

  const { data: managers } = await supabase
    .from('profiles')
    .select('id')
    .in('role', ['manager', 'general_manager', 'super_admin']);
  (managers || []).slice(0, 10).forEach((p) => receivers.add(p.id));

  return [...receivers];
}

function actionsFor(eventType, ticketId) {
  const view = { action_key: 'view', label: 'View', module: MODULE, reference_id: ticketId };
  if (eventType === 'ticket_created') {
    return [
      view,
      { action_key: 'approve', label: 'Approve', module: MODULE, reference_id: ticketId },
      { action_key: 'reject', label: 'Reject', module: MODULE, reference_id: ticketId },
    ];
  }
  if (eventType === 'assigned' || eventType === 'reassigned') {
    return [
      view,
      { action_key: 'complete', label: 'Complete', module: MODULE, reference_id: ticketId },
    ];
  }
  return [view];
}

/**
 * Emit notifications for a Request Hub lifecycle event.
 */
export async function notifyRequestHubEvent({ eventType, ticket, actor, previousAssignee, remark }) {
  if (!isNotificationsEnabled() || !ticket) return;

  const titleByEvent = {
    ticket_created: `New request ${ticket.ticket_number}`,
    assigned: `Assigned ${ticket.ticket_number}`,
    reassigned: `Reassigned ${ticket.ticket_number}`,
    remark_added: `Comment on ${ticket.ticket_number}`,
    priority_changed: `Priority changed · ${ticket.ticket_number}`,
    status_changed: `Status update · ${ticket.ticket_number}`,
    information_requested: `Info needed · ${ticket.ticket_number}`,
    information_added: `Info added · ${ticket.ticket_number}`,
    resolved: `Resolved · ${ticket.ticket_number}`,
    rejected: `Rejected · ${ticket.ticket_number}`,
    closed: `Closed · ${ticket.ticket_number}`,
  };

  const receivers = new Set();

  if (eventType === 'ticket_created') {
    (await findLeadsForTicket(ticket)).forEach((id) => receivers.add(id));
  } else if (eventType === 'assigned' || eventType === 'reassigned') {
    if (ticket.assigned_to) receivers.add(ticket.assigned_to);
    if (previousAssignee) receivers.add(previousAssignee);
  } else if (eventType === 'information_requested') {
    if (ticket.created_by) receivers.add(ticket.created_by);
  } else {
    if (ticket.created_by) receivers.add(ticket.created_by);
    if (ticket.assigned_to) receivers.add(ticket.assigned_to);
  }

  if (actor?.id) receivers.delete(actor.id);

  const payloads = [...receivers].map((receiver) => ({
    receiver,
    sender: actor?.id || null,
    module: MODULE,
    referenceId: ticket.id,
    title: titleByEvent[eventType] || `Update · ${ticket.ticket_number}`,
    message: remark || ticket.title || 'Smart Request Hub update',
    actionRequired: ['ticket_created', 'assigned', 'reassigned', 'information_requested'].includes(eventType),
    priority: ticket.priority === 'Critical' ? 'Critical' : ticket.priority === 'High' ? 'High' : 'Normal',
    actions: actionsFor(eventType, ticket.id),
    metadata: {
      ticket_number: ticket.ticket_number,
      hash: `#request-hub`,
      eventType,
    },
  }));

  if (!payloads.length) return;
  await sendNotification(payloads);
}

/**
 * Daily Tracker notification helpers (minimal).
 */
export async function notifyDailyTrackerEvent({ type, receiverIds, title, message, senderId, entryId }) {
  if (!isNotificationsEnabled() || !receiverIds?.length) return;
  const payloads = receiverIds.map((receiver) => ({
    receiver,
    sender: senderId || null,
    module: 'daily_tracker',
    referenceId: entryId || null,
    title,
    message,
    actionRequired: false,
    priority: 'Normal',
    metadata: { type },
  }));
  await sendNotification(payloads);
}
