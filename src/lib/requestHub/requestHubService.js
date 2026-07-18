import { supabase } from '../supabase';
import { recordTicketEvent, getTicketEvents } from './requestHubAudit';
import { createUniqueTicketNumber } from './requestHubNumber';
import { getNextStatusForRequestAction } from './requestHubWorkflow';
import { isNotificationsEnabled } from '../featureFlags';
import { notifyRequestHubEvent } from '../notifications/notificationRules';

const BUCKET = 'request-hub-screenshots';
const MAX_SCREENSHOTS = 10;
const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME = ['image/png', 'image/jpeg', 'image/webp'];

async function maybeNotify(payload) {
  if (!isNotificationsEnabled()) return;
  try {
    await notifyRequestHubEvent(payload);
  } catch (err) {
    console.warn('Request Hub notification skipped:', err?.message || err);
  }
}

function safeFileName(name) {
  return String(name || 'screenshot.png').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
}

export async function createRequest(payload, files = [], profile) {
  const browser =
    typeof navigator !== 'undefined'
      ? `${navigator.userAgent || ''}`.slice(0, 240)
      : null;
  const resolution =
    typeof window !== 'undefined' ? `${window.screen?.width}x${window.screen?.height}` : null;
  const timezone =
    typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : null;

  const baseRow = {
    project_name: payload.project_name || null,
    client_id: payload.client_id || null,
    client_ref: payload.client_ref || null,
    sub_division: payload.sub_division || null,
    task_type: payload.task_type || null,
    category: payload.category,
    title: payload.title,
    description: payload.description,
    additional_information: payload.additional_information || null,
    current_page_url: payload.current_page_url || (typeof window !== 'undefined' ? window.location.href : null),
    current_component: payload.current_component || 'Smart Request Hub',
    browser,
    resolution,
    timezone,
    created_by: profile.id,
    created_role: profile.role,
    status: 'Request',
    priority: payload.priority || 'Medium',
  };

  const { data: ticket, error } = await createUniqueTicketNumber(async (ticketNumber) => {
    return supabase
      .from('request_hub_tickets')
      .insert({ ...baseRow, ticket_number: ticketNumber })
      .select('*')
      .single();
  });

  if (error) throw error;

  await recordTicketEvent({
    ticketId: ticket.id,
    actorId: profile.id,
    actorRole: profile.role,
    eventType: 'ticket_created',
    newStatus: 'Request',
    newPriority: ticket.priority,
    metadata: { ticket_number: ticket.ticket_number },
  });

  if (files?.length) {
    await uploadRequestScreenshots(ticket.id, files, profile);
  }

  await maybeNotify({
    eventType: 'ticket_created',
    ticket,
    actor: profile,
  });

  return ticket;
}

export async function getRequests(filters = {}) {
  let query = supabase
    .from('request_hub_tickets')
    .select('*')
    .is('archived_at', null)
    .order('created_date', { ascending: false })
    .limit(filters.limit || 50);

  if (filters.status) query = query.eq('status', filters.status);
  if (filters.priority) query = query.eq('priority', filters.priority);
  if (filters.client_id) query = query.eq('client_id', filters.client_id);
  if (filters.category) query = query.eq('category', filters.category);
  if (filters.assigned_to) query = query.eq('assigned_to', filters.assigned_to);
  if (filters.created_by) query = query.eq('created_by', filters.created_by);
  if (filters.search) {
    query = query.or(
      `title.ilike.%${filters.search}%,ticket_number.ilike.%${filters.search}%,description.ilike.%${filters.search}%`
    );
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function getRequestById(id) {
  const { data, error } = await supabase
    .from('request_hub_tickets')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

export async function updateRequestStatus(ticketId, nextStatus, remark, profile, eventType = 'status_changed') {
  const ticket = await getRequestById(ticketId);
  const updates = {
    status: nextStatus,
    updated_at: new Date().toISOString(),
    last_activity_at: new Date().toISOString(),
  };

  if (nextStatus === 'Closed' || nextStatus === 'Rejected') {
    updates.closed_date = new Date().toISOString();
  }

  if (remark) {
    if (profile.role === 'general_manager') updates.gm_remark = remark;
    else if (['manager', 'super_admin'].includes(profile.role)) updates.manager_remark = remark;
    else updates.lead_remark = remark;
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
    eventType,
    oldStatus: ticket.status,
    newStatus: nextStatus,
    remark,
  });

  await maybeNotify({
    eventType,
    ticket: data,
    actor: profile,
    remark,
  });

  return data;
}

export async function assignRequest(ticketId, userId, remark, profile) {
  const ticket = await getRequestById(ticketId);
  const { data, error } = await supabase
    .from('request_hub_tickets')
    .update({
      assigned_to: userId,
      status: 'Assigned',
      updated_at: new Date().toISOString(),
      last_activity_at: new Date().toISOString(),
    })
    .eq('id', ticketId)
    .select('*')
    .single();
  if (error) throw error;

  const eventType = ticket.assigned_to ? 'reassigned' : 'assigned';
  await recordTicketEvent({
    ticketId,
    actorId: profile.id,
    actorRole: profile.role,
    eventType,
    oldStatus: ticket.status,
    newStatus: 'Assigned',
    oldAssignedTo: ticket.assigned_to,
    newAssignedTo: userId,
    remark,
  });

  await maybeNotify({
    eventType,
    ticket: data,
    actor: profile,
    previousAssignee: ticket.assigned_to,
    remark,
  });

  return data;
}

export async function changeRequestPriority(ticketId, priority, remark, profile) {
  const ticket = await getRequestById(ticketId);
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

  await recordTicketEvent({
    ticketId,
    actorId: profile.id,
    actorRole: profile.role,
    eventType: 'priority_changed',
    oldPriority: ticket.priority,
    newPriority: priority,
    remark,
  });

  await maybeNotify({
    eventType: 'priority_changed',
    ticket: data,
    actor: profile,
    remark,
  });

  return data;
}

export async function addRequestRemark(ticketId, remarkType, remark, profile) {
  const col =
    remarkType === 'gm'
      ? 'gm_remark'
      : remarkType === 'manager'
        ? 'manager_remark'
        : remarkType === 'admin'
          ? 'admin_remark'
          : 'lead_remark';

  const { data, error } = await supabase
    .from('request_hub_tickets')
    .update({
      [col]: remark,
      updated_at: new Date().toISOString(),
      last_activity_at: new Date().toISOString(),
    })
    .eq('id', ticketId)
    .select('*')
    .single();
  if (error) throw error;

  await recordTicketEvent({
    ticketId,
    actorId: profile.id,
    actorRole: profile.role,
    eventType: 'remark_added',
    remark,
    metadata: { remark_type: remarkType },
  });

  await maybeNotify({
    eventType: 'remark_added',
    ticket: data,
    actor: profile,
    remark,
  });

  return data;
}

export async function runRequestAction(ticketId, action, profile, { remark, assigneeId, priority } = {}) {
  if (action === 'assign' || action === 'reassign') {
    if (!assigneeId) throw new Error('Assignee is required');
    return assignRequest(ticketId, assigneeId, remark, profile);
  }
  if (action === 'change_priority') {
    if (!priority) throw new Error('Priority is required');
    return changeRequestPriority(ticketId, priority, remark, profile);
  }
  if (action === 'add_remark') {
    const remarkType =
      profile.role === 'general_manager'
        ? 'gm'
        : ['manager', 'super_admin'].includes(profile.role)
          ? 'manager'
          : 'lead';
    return addRequestRemark(ticketId, remarkType, remark, profile);
  }
  if (action === 'add_information') {
    const ticket = await getRequestById(ticketId);
    const updates = {
      additional_information: remark || ticket.additional_information,
      status: 'Request',
      updated_at: new Date().toISOString(),
      last_activity_at: new Date().toISOString(),
    };
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
      eventType: 'information_added',
      oldStatus: ticket.status,
      newStatus: 'Request',
      remark,
    });
    await maybeNotify({ eventType: 'information_added', ticket: data, actor: profile, remark });
    return data;
  }

  const ticket = await getRequestById(ticketId);
  const nextStatus = getNextStatusForRequestAction(action, ticket);
  const eventMap = {
    approve: 'status_changed',
    reject: 'rejected',
    need_information: 'information_requested',
    start_work: 'status_changed',
    mark_resolved: 'resolved',
    close: 'closed',
  };
  return updateRequestStatus(ticketId, nextStatus, remark, profile, eventMap[action] || 'status_changed');
}

export async function uploadRequestScreenshots(ticketId, files, profile) {
  const list = Array.from(files || []);
  if (!list.length) return [];

  const { count } = await supabase
    .from('request_hub_screenshots')
    .select('*', { count: 'exact', head: true })
    .eq('ticket_id', ticketId);

  if ((count || 0) + list.length > MAX_SCREENSHOTS) {
    throw new Error(`Maximum ${MAX_SCREENSHOTS} screenshots per ticket`);
  }

  const uploaded = [];
  for (const file of list) {
    if (!ALLOWED_MIME.includes(file.type)) {
      throw new Error('Only PNG, JPEG, and WebP images are allowed');
    }
    if (file.size > MAX_BYTES) {
      throw new Error('Each screenshot must be 10MB or less');
    }

    const path = `request-hub/${ticketId}/${Date.now()}-${safeFileName(file.name)}`;
    const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
      contentType: file.type,
      upsert: false,
    });
    if (upErr) throw upErr;

    const { data, error } = await supabase
      .from('request_hub_screenshots')
      .insert({
        ticket_id: ticketId,
        storage_bucket: BUCKET,
        storage_path: path,
        file_name: file.name,
        mime_type: file.type,
        size_bytes: file.size,
        uploaded_by: profile.id,
      })
      .select('*')
      .single();
    if (error) throw error;

    await recordTicketEvent({
      ticketId,
      actorId: profile.id,
      actorRole: profile.role,
      eventType: 'screenshot_uploaded',
      metadata: { path, file_name: file.name },
    });

    uploaded.push(data);
  }

  return uploaded;
}

export async function getRequestScreenshots(ticketId) {
  const { data, error } = await supabase
    .from('request_hub_screenshots')
    .select('*')
    .eq('ticket_id', ticketId)
    .order('created_date', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function getScreenshotSignedUrl(storagePath) {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(storagePath, 3600);
  if (error) throw error;
  return data?.signedUrl || null;
}

export { getTicketEvents };

export async function getRequestHubDashboardStats(tickets = []) {
  const open = tickets.filter((t) => !['Resolved', 'Rejected', 'Closed'].includes(t.status));
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  return {
    open: open.length,
    critical: tickets.filter((t) => t.priority === 'Critical' && !['Closed', 'Rejected'].includes(t.status)).length,
    assigned: tickets.filter((t) => t.status === 'Assigned').length,
    resolved: tickets.filter((t) => t.status === 'Resolved').length,
    rejected: tickets.filter((t) => t.status === 'Rejected').length,
    overdue: open.filter((t) => new Date(t.created_date).getTime() < sevenDaysAgo).length,
    byPriority: countBy(tickets, 'priority'),
    byCategory: countBy(tickets, 'category'),
    byStatus: countBy(tickets, 'status'),
    byClient: countBy(tickets, 'client_id'),
  };
}

function countBy(rows, key) {
  return rows.reduce((acc, row) => {
    const k = row[key] || 'Unknown';
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {});
}
