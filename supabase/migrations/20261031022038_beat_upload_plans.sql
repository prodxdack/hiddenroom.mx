set lock_timeout = '5s';
set statement_timeout = '60s';

-- Structured producer access. The legacy user_permissions rows remain the
-- compatibility contract for existing clients and are synchronized by the
-- admin RPC below.
create table if not exists public.beat_upload_access (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan_key text not null check (plan_key in ('socio_embajador', 'pago')),
  upload_limit integer not null check (upload_limit between 1 and 1000),
  assigned_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists beat_upload_access_plan_idx
  on public.beat_upload_access (plan_key, upload_limit);

alter table public.beat_upload_access enable row level security;

drop policy if exists "beat upload access own read" on public.beat_upload_access;
create policy "beat upload access own read"
on public.beat_upload_access for select
to authenticated
using (user_id = auth.uid() or public.is_admin());

drop policy if exists "beat upload access admin all" on public.beat_upload_access;
create policy "beat upload access admin all"
on public.beat_upload_access for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

revoke all on public.beat_upload_access from anon, authenticated;
grant select on public.beat_upload_access to authenticated;

-- Migrate already configured legacy permission keys into the structured table.
insert into public.beat_upload_access (user_id, plan_key, upload_limit)
select
  permissions.user_id::uuid,
  max(case
    when lower(btrim(permissions.permission_key)) ~ '^beats\\.upload\\.plan\\.(socio_embajador|pago)$'
      then substring(lower(btrim(permissions.permission_key)) from '^beats\\.upload\\.plan\\.(socio_embajador|pago)$')
  end),
  max(case
    when lower(btrim(permissions.permission_key)) ~ '^beats\\.upload\\.limit\\.[0-9]{1,4}$'
      then substring(lower(btrim(permissions.permission_key)) from '^beats\\.upload\\.limit\\.([0-9]{1,4})$')::integer
  end)
from public.user_permissions permissions
where permissions.user_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
group by permissions.user_id
having max(case
  when lower(btrim(permissions.permission_key)) ~ '^beats\\.upload\\.plan\\.(socio_embajador|pago)$'
    then substring(lower(btrim(permissions.permission_key)) from '^beats\\.upload\\.plan\\.(socio_embajador|pago)$')
end) is not null
and max(case
  when lower(btrim(permissions.permission_key)) ~ '^beats\\.upload\\.limit\\.[0-9]{1,4}$'
    then substring(lower(btrim(permissions.permission_key)) from '^beats\\.upload\\.limit\\.([0-9]{1,4})$')::integer
end) between 1 and 1000
on conflict (user_id) do update
set plan_key = excluded.plan_key,
    upload_limit = excluded.upload_limit,
    updated_at = now();

create or replace function public.beat_upload_access_config(
  p_user_id uuid default auth.uid()
)
returns table (
  plan_key text,
  upload_limit integer,
  used_uploads integer,
  remaining_uploads integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  configured public.beat_upload_access%rowtype;
  legacy_plan text;
  legacy_limit integer;
  used_count integer;
begin
  if p_user_id is null then
    return;
  end if;

  select * into configured
  from public.beat_upload_access
  where user_id = p_user_id;

  if not found then
    select
      max(case
        when lower(btrim(permission_key)) ~ '^beats\\.upload\\.plan\\.(socio_embajador|pago)$'
          then substring(lower(btrim(permission_key)) from '^beats\\.upload\\.plan\\.(socio_embajador|pago)$')
      end),
      max(case
        when lower(btrim(permission_key)) ~ '^beats\\.upload\\.limit\\.[0-9]{1,4}$'
          then substring(lower(btrim(permission_key)) from '^beats\\.upload\\.limit\\.([0-9]{1,4})$')::integer
      end)
    into legacy_plan, legacy_limit
    from public.user_permissions
    where user_id = p_user_id::text;
  end if;

  select count(*)::integer into used_count
  from public.store_products
  where category = 'beats'
    and producer_user_id = p_user_id
    and coalesce(publication_status, 'draft') <> 'inactive';

  plan_key := coalesce(configured.plan_key, legacy_plan);
  upload_limit := coalesce(configured.upload_limit, legacy_limit);
  used_uploads := used_count;
  remaining_uploads := case
    when upload_limit is null then null
    else greatest(upload_limit - used_count, 0)
  end;
  return next;
end;
$$;

create or replace function public.has_beats_upload_permission()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
    and (
      public.is_admin()
      or exists (
        select 1
        from public.beat_upload_access access
        where access.user_id = auth.uid()
      )
      or exists (
        select 1
        from public.user_permissions permissions
        where permissions.user_id = auth.uid()::text
          and lower(btrim(permissions.permission_key)) = 'beats.upload'
      )
    );
$$;

create or replace function public.beat_upload_quota_available(
  p_user_id uuid default auth.uid(),
  p_exclude_beat_id uuid default null
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  config record;
  active_count integer;
begin
  if p_user_id is null then
    return false;
  end if;
  if p_user_id <> auth.uid() and not public.is_admin() then
    raise exception 'Not authorized';
  end if;
  if public.is_admin() then
    return true;
  end if;
  if not public.has_beats_upload_permission() then
    return false;
  end if;

  select * into config from public.beat_upload_access_config(p_user_id);
  if config.upload_limit is null then
    return true;
  end if;

  select count(*)::integer into active_count
  from public.store_products
  where category = 'beats'
    and producer_user_id = p_user_id
    and coalesce(publication_status, 'draft') <> 'inactive'
    and (p_exclude_beat_id is null or id <> p_exclude_beat_id);
  return active_count < config.upload_limit;
end;
$$;

create or replace function public.admin_set_beat_upload_access(
  p_user_id uuid,
  p_plan_key text,
  p_upload_limit integer
)
returns public.beat_upload_access
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.beat_upload_access;
  normalized_plan text := lower(btrim(coalesce(p_plan_key, '')));
begin
  if not public.is_admin() then
    raise exception 'Not authorized';
  end if;
  if p_user_id is null then
    raise exception 'Producer is required';
  end if;
  if normalized_plan not in ('socio_embajador', 'pago') then
    raise exception 'Invalid producer plan';
  end if;
  if p_upload_limit is null or p_upload_limit < 1 or p_upload_limit > 1000 then
    raise exception 'Upload limit must be between 1 and 1000';
  end if;
  if not exists (select 1 from auth.users where id = p_user_id) then
    raise exception 'Producer account not found';
  end if;

  insert into public.beat_upload_access (user_id, plan_key, upload_limit, assigned_by)
  values (p_user_id, normalized_plan, p_upload_limit, auth.uid())
  on conflict (user_id) do update
  set plan_key = excluded.plan_key,
      upload_limit = excluded.upload_limit,
      assigned_by = excluded.assigned_by,
      updated_at = now()
  returning * into result;

  delete from public.user_permissions
  where user_id = p_user_id::text
    and (
      lower(btrim(permission_key)) = 'beats.upload'
      or lower(btrim(permission_key)) like 'beats.upload.plan.%'
      or lower(btrim(permission_key)) like 'beats.upload.limit.%'
    );

  insert into public.user_permissions (user_id, permission_key)
  values
    (p_user_id::text, 'beats.upload'),
    (p_user_id::text, 'beats.upload.plan.' || normalized_plan),
    (p_user_id::text, 'beats.upload.limit.' || p_upload_limit::text);

  return result;
end;
$$;

create or replace function public.admin_revoke_beat_upload_access(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Not authorized';
  end if;
  delete from public.beat_upload_access where user_id = p_user_id;
  delete from public.user_permissions
  where user_id = p_user_id::text
    and (
      lower(btrim(permission_key)) = 'beats.upload'
      or lower(btrim(permission_key)) like 'beats.upload.plan.%'
      or lower(btrim(permission_key)) like 'beats.upload.limit.%'
    );
end;
$$;

create or replace function public.enforce_beat_upload_quota()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Service-role jobs have no auth.uid() and remain allowed to maintain
  -- existing records. Client writes are checked here in addition to RLS.
  if new.category = 'beats'
     and new.producer_user_id is not null
     and auth.uid() is not null
     and not public.is_admin()
     and coalesce(new.publication_status, 'draft') <> 'inactive' then
    if new.producer_user_id <> auth.uid() then
      raise exception 'Producer is not authorized for this beat';
    end if;
    perform pg_advisory_xact_lock(hashtext(new.producer_user_id::text)::bigint);
    if not public.beat_upload_quota_available(new.producer_user_id, case when tg_op = 'UPDATE' then new.id else null end) then
      raise exception 'Se alcanzó el límite de subidas del plan del productor';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_beat_upload_quota on public.store_products;
create trigger enforce_beat_upload_quota
before insert or update of category, producer_user_id, publication_status
on public.store_products
for each row execute function public.enforce_beat_upload_quota();

drop policy if exists "store products producer insert draft" on public.store_products;
create policy "store products producer insert draft"
on public.store_products for insert
to authenticated
with check (
  category = 'beats'
  and producer_user_id = auth.uid()
  and public.beat_upload_quota_available(auth.uid(), null)
  and publication_status = 'draft'
  and is_active = false
  and (
    producer_profile_id is null
    or exists (
      select 1
      from public.producer_profiles profiles
      where profiles.id = producer_profile_id
        and profiles.user_id = auth.uid()
    )
  )
);

revoke all on function public.beat_upload_access_config(uuid) from public, anon, service_role;
grant execute on function public.beat_upload_access_config(uuid) to authenticated;
revoke all on function public.beat_upload_quota_available(uuid, uuid) from public, anon, service_role;
grant execute on function public.beat_upload_quota_available(uuid, uuid) to authenticated;
revoke all on function public.admin_set_beat_upload_access(uuid, text, integer) from public, anon, service_role;
grant execute on function public.admin_set_beat_upload_access(uuid, text, integer) to authenticated;
revoke all on function public.admin_revoke_beat_upload_access(uuid) from public, anon, service_role;
grant execute on function public.admin_revoke_beat_upload_access(uuid) to authenticated;
revoke all on function public.enforce_beat_upload_quota() from public, anon, authenticated, service_role;

comment on table public.beat_upload_access is
  'Structured Beat Store producer plan and active beat upload quota.';
comment on column public.beat_upload_access.upload_limit is
  'Maximum simultaneous non-inactive beats for the producer.';

set lock_timeout = '5s';
set statement_timeout = '60s';
