-- ==========================================
-- 09_REQUEST_HUB_RLS_FIX.sql
-- Fix SELECT RLS on INSERT … RETURNING for creators.
-- Safe to re-run on existing projects.
-- ==========================================

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
