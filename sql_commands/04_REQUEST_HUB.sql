-- ==========================================
-- Smart Request Hub — Phase 1
-- ==========================================
-- PREREQUISITE: Run previous numbered scripts in order (01 → 02 → 03).
-- Active roles only: performer, team_lead, group_lead, manager, general_manager, super_admin
-- ==========================================

begin;

create extension if not exists pgcrypto;

-- ─────────────────────────────────────────
-- Tables
-- ─────────────────────────────────────────

create table if not exists public.request_hub_tickets (
  id uuid primary key default gen_random_uuid(),
  ticket_number text not null unique,
  project_name text,
  client_id text,
  client_ref uuid references public.clients(id) on delete set null,
  sub_division text,
  task_type text,
  category text not null,
  title text not null,
  description text not null,
  additional_information text,
  current_page_url text,
  current_component text,
  browser text,
  resolution text,
  timezone text,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_role text,
  created_date timestamptz not null default now(),
  status text not null default 'Request',
  priority text not null default 'Medium',
  assigned_to uuid references auth.users(id) on delete set null,
  lead_remark text,
  admin_remark text,
  manager_remark text,
  gm_remark text,
  closed_date timestamptz,
  last_activity_at timestamptz not null default now(),
  archived_at timestamptz,
  archived_by uuid references auth.users(id) on delete set null,
  archive_reason text,
  updated_at timestamptz not null default now(),
  constraint request_hub_category_check
    check (category in ('Bug', 'Improvement', 'Feature Update', 'Enhancement')),
  constraint request_hub_status_check
    check (status in ('Request', 'Verified', 'Assigned', 'In Progress', 'Need Information', 'Resolved', 'Rejected', 'Closed')),
  constraint request_hub_priority_check
    check (priority in ('Low', 'Medium', 'High', 'Critical')),
  constraint request_hub_sub_division_check
    check (sub_division is null or sub_division in ('PreEdit', 'Validation'))
);

create index if not exists idx_request_hub_tickets_created_by
  on public.request_hub_tickets(created_by);
create index if not exists idx_request_hub_tickets_assigned_to
  on public.request_hub_tickets(assigned_to);
create index if not exists idx_request_hub_tickets_status
  on public.request_hub_tickets(status);
create index if not exists idx_request_hub_tickets_priority
  on public.request_hub_tickets(priority);
create index if not exists idx_request_hub_tickets_client_id
  on public.request_hub_tickets(client_id);
create index if not exists idx_request_hub_tickets_client_ref
  on public.request_hub_tickets(client_ref);
create index if not exists idx_request_hub_tickets_created_date
  on public.request_hub_tickets(created_date desc);
create index if not exists idx_request_hub_tickets_last_activity
  on public.request_hub_tickets(last_activity_at);
create index if not exists idx_request_hub_tickets_archived_at
  on public.request_hub_tickets(archived_at);

create table if not exists public.request_hub_screenshots (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.request_hub_tickets(id) on delete cascade,
  storage_bucket text not null default 'request-hub-screenshots',
  storage_path text not null,
  file_name text not null,
  mime_type text,
  size_bytes integer,
  uploaded_by uuid not null references auth.users(id) on delete cascade,
  created_date timestamptz not null default now(),
  constraint request_hub_screenshot_size_check
    check (size_bytes is null or size_bytes <= 10485760)
);

create index if not exists idx_request_hub_screenshots_ticket_id
  on public.request_hub_screenshots(ticket_id);

create table if not exists public.request_hub_events (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.request_hub_tickets(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  actor_role text,
  event_type text not null,
  old_status text,
  new_status text,
  old_priority text,
  new_priority text,
  old_assigned_to uuid references auth.users(id) on delete set null,
  new_assigned_to uuid references auth.users(id) on delete set null,
  remark text,
  metadata jsonb not null default '{}'::jsonb,
  created_date timestamptz not null default now()
);

create index if not exists idx_request_hub_events_ticket_id
  on public.request_hub_events(ticket_id, created_date desc);
create index if not exists idx_request_hub_events_actor_id
  on public.request_hub_events(actor_id);

-- ─────────────────────────────────────────
-- Helper functions (NEW — do not use stale get_user_role_level alone)
-- ─────────────────────────────────────────

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role::text from public.profiles where id = auth.uid();
$$;

create or replace function public.can_view_request_hub_ticket(p_ticket_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_role text;
  v_team uuid;
  v_client_ref uuid;
  v_sub text;
  t record;
begin
  -- Load ticket first so INSERT … RETURNING can see the new row for the creator
  -- even if profile/role lookup is delayed or incomplete.
  select * into t from public.request_hub_tickets where id = p_ticket_id;
  if not found then
    return false;
  end if;

  if t.created_by = auth.uid() or t.assigned_to = auth.uid() then
    return true;
  end if;

  select role::text, team_id, client_ref, sub_division
    into v_role, v_team, v_client_ref, v_sub
  from public.profiles
  where id = auth.uid();

  if v_role is null then
    return false;
  end if;

  if v_role in ('super_admin', 'general_manager', 'manager') then
    return true;
  end if;

  if v_role = 'team_lead' and v_team is not null then
    return exists (
      select 1 from public.profiles p
      where p.team_id = v_team
        and p.id in (t.created_by, t.assigned_to)
    );
  end if;

  if v_role = 'group_lead' and v_client_ref is not null then
    if t.client_ref = v_client_ref
       and (v_sub is null or t.sub_division is null or t.sub_division = v_sub) then
      return true;
    end if;
    return exists (
      select 1 from public.profiles p
      where p.client_ref = v_client_ref
        and (v_sub is null or p.sub_division = v_sub)
        and p.id in (t.created_by, t.assigned_to)
    );
  end if;

  return false;
end;
$$;

create or replace function public.can_manage_request_hub_ticket(p_ticket_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_role text;
begin
  v_role := public.current_user_role();
  if v_role in ('super_admin', 'general_manager', 'manager', 'team_lead', 'group_lead') then
    return public.can_view_request_hub_ticket(p_ticket_id);
  end if;
  return false;
end;
$$;

-- ─────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────

alter table public.request_hub_tickets enable row level security;
alter table public.request_hub_screenshots enable row level security;
alter table public.request_hub_events enable row level security;

drop policy if exists "request_hub_tickets_select" on public.request_hub_tickets;
create policy "request_hub_tickets_select"
on public.request_hub_tickets for select to authenticated
using (public.can_view_request_hub_ticket(id));

drop policy if exists "request_hub_tickets_insert" on public.request_hub_tickets;
create policy "request_hub_tickets_insert"
on public.request_hub_tickets for insert to authenticated
with check (created_by = auth.uid());

drop policy if exists "request_hub_tickets_update" on public.request_hub_tickets;
create policy "request_hub_tickets_update"
on public.request_hub_tickets for update to authenticated
using (
  created_by = auth.uid()
  or assigned_to = auth.uid()
  or public.can_manage_request_hub_ticket(id)
)
with check (
  created_by = auth.uid()
  or assigned_to = auth.uid()
  or public.can_manage_request_hub_ticket(id)
);

drop policy if exists "request_hub_screenshots_select" on public.request_hub_screenshots;
create policy "request_hub_screenshots_select"
on public.request_hub_screenshots for select to authenticated
using (public.can_view_request_hub_ticket(ticket_id));

drop policy if exists "request_hub_screenshots_insert" on public.request_hub_screenshots;
create policy "request_hub_screenshots_insert"
on public.request_hub_screenshots for insert to authenticated
with check (
  uploaded_by = auth.uid()
  and public.can_view_request_hub_ticket(ticket_id)
);

drop policy if exists "request_hub_events_select" on public.request_hub_events;
create policy "request_hub_events_select"
on public.request_hub_events for select to authenticated
using (public.can_view_request_hub_ticket(ticket_id));

drop policy if exists "request_hub_events_insert" on public.request_hub_events;
create policy "request_hub_events_insert"
on public.request_hub_events for insert to authenticated
with check (
  actor_id = auth.uid()
  and public.can_view_request_hub_ticket(ticket_id)
);

grant select, insert, update on public.request_hub_tickets to authenticated;
grant select, insert on public.request_hub_screenshots to authenticated;
grant select, insert on public.request_hub_events to authenticated;

-- ─────────────────────────────────────────
-- Storage bucket + policies (first bucket)
-- ─────────────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'request-hub-screenshots',
  'request-hub-screenshots',
  false,
  10485760,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "request_hub_screenshots_storage_select" on storage.objects;
create policy "request_hub_screenshots_storage_select"
on storage.objects for select to authenticated
using (
  bucket_id = 'request-hub-screenshots'
  and public.can_view_request_hub_ticket(
    nullif(split_part(name, '/', 2), '')::uuid
  )
);

drop policy if exists "request_hub_screenshots_storage_insert" on storage.objects;
create policy "request_hub_screenshots_storage_insert"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'request-hub-screenshots'
  and (storage.foldername(name))[1] = 'request-hub'
  and public.can_view_request_hub_ticket(
    nullif(split_part(name, '/', 2), '')::uuid
  )
);

commit;
