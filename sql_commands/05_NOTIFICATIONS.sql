-- ==========================================
-- Enterprise Notifications — Phase 2
-- ==========================================
-- Depends on: ROLE_RLS_PREFLIGHT, SMART_REQUEST_HUB_PHASE1
-- ==========================================

begin;

create extension if not exists pgcrypto;

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  receiver uuid not null references auth.users(id) on delete cascade,
  sender uuid references auth.users(id) on delete set null,
  module text not null,
  reference_id uuid,
  title text not null,
  message text not null,
  status text not null default 'active',
  action_required boolean not null default false,
  priority text not null default 'Normal',
  read boolean not null default false,
  created_date timestamptz not null default now(),
  expire_date timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  email_sent_at timestamptz,
  email_error text,
  email_attempts integer not null default 0,
  constraint notifications_status_check
    check (status in ('active', 'dismissed', 'completed', 'expired')),
  constraint notifications_priority_check
    check (priority in ('Low', 'Normal', 'High', 'Critical'))
);

create index if not exists idx_notifications_receiver_read
  on public.notifications(receiver, read, created_date desc);
create index if not exists idx_notifications_module_reference
  on public.notifications(module, reference_id);
create index if not exists idx_notifications_expire_date
  on public.notifications(expire_date);

create table if not exists public.notification_actions (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.notifications(id) on delete cascade,
  action_key text not null,
  label text not null,
  module text not null,
  reference_id uuid,
  created_date timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists idx_notification_actions_notification
  on public.notification_actions(notification_id);

create table if not exists public.notification_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  module text not null,
  bell_enabled boolean not null default true,
  toast_enabled boolean not null default true,
  email_enabled boolean not null default false,
  system_alert_enabled boolean not null default true,
  created_date timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, module)
);

create table if not exists public.request_hub_reminder_deliveries (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.request_hub_tickets(id) on delete cascade,
  reminder_kind text not null default 'stale_assigned_48h',
  notified_user_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists idx_request_hub_reminder_ticket_created
  on public.request_hub_reminder_deliveries(ticket_id, created_at desc);

-- RLS
alter table public.notifications enable row level security;
alter table public.notification_actions enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.request_hub_reminder_deliveries enable row level security;

drop policy if exists "notifications_select_own" on public.notifications;
create policy "notifications_select_own"
on public.notifications for select to authenticated
using (receiver = auth.uid());

drop policy if exists "notifications_update_own" on public.notifications;
create policy "notifications_update_own"
on public.notifications for update to authenticated
using (receiver = auth.uid())
with check (receiver = auth.uid());

-- No browser INSERT for notifications — Edge Function / service role only

drop policy if exists "notification_actions_select_own" on public.notification_actions;
create policy "notification_actions_select_own"
on public.notification_actions for select to authenticated
using (
  exists (
    select 1 from public.notifications n
    where n.id = notification_id and n.receiver = auth.uid()
  )
);

drop policy if exists "notification_preferences_all_own" on public.notification_preferences;
create policy "notification_preferences_all_own"
on public.notification_preferences for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "request_hub_reminder_deliveries_select_admin" on public.request_hub_reminder_deliveries;
create policy "request_hub_reminder_deliveries_select_admin"
on public.request_hub_reminder_deliveries for select to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role in ('super_admin', 'general_manager')
  )
);

grant select, update on public.notifications to authenticated;
grant select on public.notification_actions to authenticated;
grant select, insert, update, delete on public.notification_preferences to authenticated;
grant select on public.request_hub_reminder_deliveries to authenticated;

commit;
