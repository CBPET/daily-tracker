import { supabase } from '../supabase';
import { recordTicketEvent } from '../requestHub/requestHubAudit';

const AUDIT_LIMIT = 100;

async function writeAudit({ entityId, actorId, actorRole, action, oldValues, newValues, reason }) {
  const { error } = await supabase.from('enterprise_audit_log').insert({
    module: 'smart_request_hub',
    entity_type: 'request_hub_tickets',
    entity_id: entityId,
    actor_id: actorId,
    actor_role: actorRole,
    action,
    old_values: oldValues || null,
    new_values: newValues || null,
    reason: reason || null,
  });
  if (error) throw error;
}

export async function listGovernanceTickets({ includeArchived = false, limit = 50 } = {}) {
  let query = supabase
    .from('request_hub_tickets')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(limit);
  if (!includeArchived) query = query.is('archived_at', null);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function overrideTicketStatus(ticketId, nextStatus, reason, profile) {
  if (!reason?.trim()) throw new Error('Reason is required for governance override');
  const { data: old, error: fetchErr } = await supabase
    .from('request_hub_tickets')
    .select('*')
    .eq('id', ticketId)
    .single();
  if (fetchErr) throw fetchErr;

  const updates = {
    status: nextStatus,
    updated_at: new Date().toISOString(),
    last_activity_at: new Date().toISOString(),
  };
  if (['Closed', 'Rejected'].includes(nextStatus)) {
    updates.closed_date = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from('request_hub_tickets')
    .update(updates)
    .eq('id', ticketId)
    .select('*')
    .single();
  if (error) throw error;

  await recordTicketEvent({
    ticketId,
    actorId: profile.id,
    actorRole: profile.role,
    eventType: 'status_changed',
    oldStatus: old.status,
    newStatus: nextStatus,
    remark: reason,
    metadata: { governance: true },
  });

  await writeAudit({
    entityId: ticketId,
    actorId: profile.id,
    actorRole: profile.role,
    action: 'status_override',
    oldValues: { status: old.status },
    newValues: { status: nextStatus },
    reason,
  });

  return data;
}

export async function transferOwnership(ticketId, newOwnerId, reason, profile) {
  if (!reason?.trim()) throw new Error('Reason is required');
  const { data: old, error: fetchErr } = await supabase
    .from('request_hub_tickets')
    .select('*')
    .eq('id', ticketId)
    .single();
  if (fetchErr) throw fetchErr;

  const { data, error } = await supabase
    .from('request_hub_tickets')
    .update({
      created_by: newOwnerId,
      updated_at: new Date().toISOString(),
      last_activity_at: new Date().toISOString(),
    })
    .eq('id', ticketId)
    .select('*')
    .single();
  if (error) throw error;

  await writeAudit({
    entityId: ticketId,
    actorId: profile.id,
    actorRole: profile.role,
    action: 'transfer_ownership',
    oldValues: { created_by: old.created_by },
    newValues: { created_by: newOwnerId },
    reason,
  });

  return data;
}

export async function editTicketPriority(ticketId, priority, reason, profile) {
  if (!reason?.trim()) throw new Error('Reason is required');
  const { data: old } = await supabase.from('request_hub_tickets').select('*').eq('id', ticketId).single();
  const { data, error } = await supabase
    .from('request_hub_tickets')
    .update({
      priority,
      updated_at: new Date().toISOString(),
      last_activity_at: new Date().toISOString(),
    })
    .eq('id', ticketId)
    .select('*')
    .single();
  if (error) throw error;

  await writeAudit({
    entityId: ticketId,
    actorId: profile.id,
    actorRole: profile.role,
    action: 'edit_priority',
    oldValues: { priority: old?.priority },
    newValues: { priority },
    reason,
  });
  return data;
}

export async function archiveTicket(ticketId, reason, profile) {
  if (!reason?.trim()) throw new Error('Reason is required');
  const { data: old } = await supabase.from('request_hub_tickets').select('*').eq('id', ticketId).single();
  const { data, error } = await supabase
    .from('request_hub_tickets')
    .update({
      archived_at: new Date().toISOString(),
      archived_by: profile.id,
      archive_reason: reason,
      updated_at: new Date().toISOString(),
    })
    .eq('id', ticketId)
    .select('*')
    .single();
  if (error) throw error;

  await writeAudit({
    entityId: ticketId,
    actorId: profile.id,
    actorRole: profile.role,
    action: 'archive',
    oldValues: { archived_at: old?.archived_at },
    newValues: { archived_at: data.archived_at },
    reason,
  });
  return data;
}

export async function restoreTicket(ticketId, reason, profile) {
  if (!reason?.trim()) throw new Error('Reason is required');
  const { data, error } = await supabase
    .from('request_hub_tickets')
    .update({
      archived_at: null,
      archived_by: null,
      archive_reason: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', ticketId)
    .select('*')
    .single();
  if (error) throw error;

  await writeAudit({
    entityId: ticketId,
    actorId: profile.id,
    actorRole: profile.role,
    action: 'restore',
    newValues: { archived_at: null },
    reason,
  });
  return data;
}

/** Soft-merge: mark source archived and link to target in metadata/audit. */
export async function mergeTickets(sourceId, targetId, reason, profile) {
  if (!reason?.trim()) throw new Error('Reason is required');
  if (sourceId === targetId) throw new Error('Cannot merge a ticket into itself');

  const { data: source } = await supabase.from('request_hub_tickets').select('*').eq('id', sourceId).single();
  const { data: target } = await supabase.from('request_hub_tickets').select('*').eq('id', targetId).single();

  await archiveTicket(sourceId, `Merged into ${target?.ticket_number || targetId}: ${reason}`, profile);

  await writeAudit({
    entityId: targetId,
    actorId: profile.id,
    actorRole: profile.role,
    action: 'merge_tickets',
    oldValues: { source_id: sourceId, source_number: source?.ticket_number },
    newValues: { target_id: targetId, target_number: target?.ticket_number },
    reason,
  });

  return target;
}

export async function getGovernanceAuditLog({ entityId, limit = AUDIT_LIMIT } = {}) {
  let query = supabase
    .from('enterprise_audit_log')
    .select('*')
    .eq('module', 'smart_request_hub')
    .order('created_date', { ascending: false })
    .limit(limit);
  if (entityId) query = query.eq('entity_id', entityId);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}
