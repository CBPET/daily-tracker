import { supabase } from '../supabase';

/**
 * Insert a request_hub_events row and bump last_activity_at on the ticket.
 */
export async function recordTicketEvent({
  ticketId,
  actorId,
  actorRole,
  eventType,
  oldStatus = null,
  newStatus = null,
  oldPriority = null,
  newPriority = null,
  oldAssignedTo = null,
  newAssignedTo = null,
  remark = null,
  metadata = {},
}) {
  const { error: eventError } = await supabase.from('request_hub_events').insert({
    ticket_id: ticketId,
    actor_id: actorId,
    actor_role: actorRole,
    event_type: eventType,
    old_status: oldStatus,
    new_status: newStatus,
    old_priority: oldPriority,
    new_priority: newPriority,
    old_assigned_to: oldAssignedTo,
    new_assigned_to: newAssignedTo,
    remark,
    metadata,
  });

  if (eventError) throw eventError;

  const { error: bumpError } = await supabase
    .from('request_hub_tickets')
    .update({
      last_activity_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', ticketId);

  if (bumpError) throw bumpError;
}

export async function getTicketEvents(ticketId) {
  const { data, error } = await supabase
    .from('request_hub_events')
    .select('*')
    .eq('ticket_id', ticketId)
    .order('created_date', { ascending: false })
    .limit(100);

  if (error) throw error;
  return data || [];
}
