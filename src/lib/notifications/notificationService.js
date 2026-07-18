import { supabase } from '../supabase';

const FUNCTIONS_BASE = () => {
  const url = import.meta.env.VITE_SUPABASE_URL || '';
  return `${url.replace(/\/$/, '')}/functions/v1`;
};

export async function sendNotification(payload) {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  if (!token) throw new Error('Not authenticated');

  const body = Array.isArray(payload)
    ? { notifications: payload }
    : { notifications: [payload] };

  const res = await fetch(`${FUNCTIONS_BASE()}/dispatch-notification`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
    },
    body: JSON.stringify(body),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.ok) {
    throw new Error(json.error || 'Failed to dispatch notification');
  }
  return json;
}

export async function getNotifications({ limit = 20, unreadOnly = false } = {}) {
  const { data: sessionData } = await supabase.auth.getSession();
  const uid = sessionData?.session?.user?.id;
  if (!uid) return [];

  let query = supabase
    .from('notifications')
    .select('*, notification_actions(*)')
    .eq('receiver', uid)
    .neq('status', 'dismissed')
    .order('created_date', { ascending: false })
    .limit(limit);

  if (unreadOnly) query = query.eq('read', false);

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function getUnreadCount() {
  const { data: sessionData } = await supabase.auth.getSession();
  const uid = sessionData?.session?.user?.id;
  if (!uid) return 0;

  const { count, error } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('receiver', uid)
    .eq('read', false)
    .eq('status', 'active');

  if (error) throw error;
  return count || 0;
}

export async function markAsRead(notificationId) {
  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('id', notificationId);
  if (error) throw error;
}

export async function markAllRead() {
  const { data: sessionData } = await supabase.auth.getSession();
  const uid = sessionData?.session?.user?.id;
  if (!uid) return;
  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('receiver', uid)
    .eq('read', false);
  if (error) throw error;
}

export async function deleteNotification(notificationId) {
  const { error } = await supabase
    .from('notifications')
    .update({ status: 'dismissed', read: true })
    .eq('id', notificationId);
  if (error) throw error;
}
