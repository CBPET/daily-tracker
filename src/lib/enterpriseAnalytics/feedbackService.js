import { supabase } from '../supabase';

const LIST_LIMIT = 50;

async function writeAudit({ module, entityType, entityId, actorId, actorRole, action, oldValues, newValues, reason }) {
  const { error } = await supabase.from('enterprise_audit_log').insert({
    module,
    entity_type: entityType,
    entity_id: entityId,
    actor_id: actorId,
    actor_role: actorRole,
    action,
    old_values: oldValues || null,
    new_values: newValues || null,
    reason: reason || null,
  });
  if (error) console.warn('Audit insert failed:', error.message);
}

export async function listFeedback(filters = {}) {
  let query = supabase
    .from('feedback_records')
    .select('*')
    .is('archived_at', null)
    .order('created_date', { ascending: false })
    .limit(filters.limit || LIST_LIMIT);

  if (filters.feedback_type) query = query.eq('feedback_type', filters.feedback_type);
  if (filters.performer_id) query = query.eq('performer_id', filters.performer_id);
  if (filters.client_id) query = query.eq('client_id', filters.client_id);
  if (filters.project_name) query = query.ilike('project_name', `%${filters.project_name}%`);
  if (filters.search) {
    query = query.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function createFeedback(payload, profile) {
  const row = {
    feedback_type: payload.feedback_type,
    project_name: payload.project_name || null,
    task_type: payload.task_type || null,
    performer_id: payload.performer_id || null,
    feedback_date: payload.feedback_date || new Date().toISOString().slice(0, 10),
    client_id: payload.client_id || null,
    sub_division: payload.sub_division || null,
    title: payload.title,
    description: payload.description,
    severity: payload.severity || 'Normal',
    created_by: profile.id,
    created_role: profile.role,
  };

  const { data, error } = await supabase.from('feedback_records').insert(row).select('*').single();
  if (error) throw error;

  await writeAudit({
    module: 'feedback',
    entityType: 'feedback_records',
    entityId: data.id,
    actorId: profile.id,
    actorRole: profile.role,
    action: 'feedback_created',
    newValues: row,
  });

  return data;
}

export async function updateFeedback(id, updates, profile) {
  const { data: old } = await supabase.from('feedback_records').select('*').eq('id', id).single();
  const { data, error } = await supabase
    .from('feedback_records')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;

  await writeAudit({
    module: 'feedback',
    entityType: 'feedback_records',
    entityId: id,
    actorId: profile.id,
    actorRole: profile.role,
    action: 'feedback_updated',
    oldValues: old,
    newValues: data,
  });

  return data;
}

export async function archiveFeedback(id, reason, profile) {
  return updateFeedback(
    id,
    {
      archived_at: new Date().toISOString(),
      archived_by: profile.id,
      archive_reason: reason || 'Archived',
    },
    profile
  );
}
