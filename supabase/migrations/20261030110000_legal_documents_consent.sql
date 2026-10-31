-- Hidden Room / MysAuth
-- Reusable legal documents, immutable versions, applicability rules and
-- server-verified acceptances. This migration is intentionally additive.

create table if not exists public.legal_documents (
  id uuid primary key default gen_random_uuid(),
  document_key text not null unique,
  name text not null,
  description text,
  document_type text not null default 'terms',
  status text not null default 'draft',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint legal_documents_key_check check (document_key ~ '^[a-z0-9][a-z0-9._-]{2,119}$'),
  constraint legal_documents_type_check check (document_type in ('terms', 'contract', 'policy', 'consent', 'notice', 'other')),
  constraint legal_documents_status_check check (status in ('draft', 'published', 'archived'))
);

create table if not exists public.legal_document_versions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.legal_documents(id) on delete cascade,
  version_label text not null,
  content text,
  storage_path text,
  mime_type text,
  content_sha256 text not null,
  status text not null default 'draft',
  published_at timestamptz,
  effective_from timestamptz not null default now(),
  requires_reacceptance boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint legal_document_versions_label_check check (char_length(btrim(version_label)) between 1 and 40),
  constraint legal_document_versions_hash_check check (content_sha256 ~ '^[0-9a-f]{64}$'),
  constraint legal_document_versions_status_check check (status in ('draft', 'published', 'archived')),
  constraint legal_document_versions_source_check check (
    nullif(btrim(content), '') is not null or nullif(btrim(storage_path), '') is not null
  ),
  unique (document_id, version_label)
);

create index if not exists legal_document_versions_current_idx
  on public.legal_document_versions (document_id, status, effective_from desc);

create table if not exists public.legal_document_rules (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.legal_documents(id) on delete cascade,
  module_key text not null,
  action_key text not null default '*',
  role_key text not null default '*',
  account_type text,
  is_required boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint legal_document_rules_module_check check (module_key ~ '^[a-z0-9][a-z0-9._-]{1,79}$'),
  constraint legal_document_rules_action_check check (action_key = '*' or action_key ~ '^[a-z0-9][a-z0-9._-]{1,79}$'),
  constraint legal_document_rules_role_check check (role_key = '*' or role_key ~ '^[a-z0-9][a-z0-9._-]{1,79}$'),
  unique (document_id, module_key, action_key, role_key, account_type)
);

create index if not exists legal_document_rules_lookup_idx
  on public.legal_document_rules (module_key, action_key, role_key, is_active);

create table if not exists public.legal_acceptances (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null references auth.users(id) on delete restrict,
  document_id uuid not null references public.legal_documents(id) on delete restrict,
  version_id uuid not null references public.legal_document_versions(id) on delete restrict,
  module_key text not null,
  action_key text not null default '',
  method text not null default 'checkbox',
  content_sha256 text not null,
  user_agent text,
  accepted_at timestamptz not null default now(),
  constraint legal_acceptances_method_check check (method in ('checkbox', 'button', 'signature', 'other')),
  constraint legal_acceptances_hash_check check (content_sha256 ~ '^[0-9a-f]{64}$'),
  unique (auth_user_id, version_id, module_key, action_key)
);

create index if not exists legal_acceptances_user_idx
  on public.legal_acceptances (auth_user_id, accepted_at desc);

create index if not exists legal_acceptances_document_idx
  on public.legal_acceptances (document_id, version_id, accepted_at desc);

drop trigger if exists legal_documents_set_updated_at on public.legal_documents;
create trigger legal_documents_set_updated_at
before update on public.legal_documents
for each row execute function public.set_updated_at();

insert into storage.buckets (id, name, public)
values ('legal-documents', 'legal-documents', false)
on conflict (id) do update set public = false;

alter table public.legal_documents enable row level security;
alter table public.legal_document_versions enable row level security;
alter table public.legal_document_rules enable row level security;
alter table public.legal_acceptances enable row level security;

drop policy if exists "legal documents published read" on public.legal_documents;
create policy "legal documents published read"
  on public.legal_documents
  for select
  to authenticated
  using (status = 'published' or public.is_admin());

drop policy if exists "legal document versions published read" on public.legal_document_versions;
create policy "legal document versions published read"
  on public.legal_document_versions
  for select
  to authenticated
  using (
    public.is_admin()
    or exists (
      select 1
      from public.legal_documents documents
      where documents.id = legal_document_versions.document_id
        and documents.status = 'published'
        and legal_document_versions.status = 'published'
    )
  );

drop policy if exists "legal document rules active read" on public.legal_document_rules;
create policy "legal document rules active read"
  on public.legal_document_rules
  for select
  to authenticated
  using (is_active or public.is_admin());

drop policy if exists "legal acceptances own read" on public.legal_acceptances;
create policy "legal acceptances own read"
  on public.legal_acceptances
  for select
  to authenticated
  using (auth_user_id = auth.uid() or public.is_admin());

revoke all on public.legal_documents from anon, authenticated;
grant select on public.legal_documents to authenticated;
revoke all on public.legal_document_versions from anon, authenticated;
grant select on public.legal_document_versions to authenticated;
revoke all on public.legal_document_rules from anon, authenticated;
grant select on public.legal_document_rules to authenticated;
revoke all on public.legal_acceptances from anon, authenticated;
grant select on public.legal_acceptances to authenticated;

drop policy if exists "legal documents admin upload" on storage.objects;
create policy "legal documents admin upload"
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'legal-documents' and public.is_admin());

drop policy if exists "legal documents admin update" on storage.objects;
create policy "legal documents admin update"
  on storage.objects
  for update
  to authenticated
  using (bucket_id = 'legal-documents' and public.is_admin())
  with check (bucket_id = 'legal-documents' and public.is_admin());

drop policy if exists "legal documents admin delete" on storage.objects;
create policy "legal documents admin delete"
  on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'legal-documents' and public.is_admin());

drop policy if exists "legal documents published file read" on storage.objects;
create policy "legal documents published file read"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'legal-documents'
    and (
      public.is_admin()
      or exists (
        select 1
        from public.legal_document_versions versions
        join public.legal_documents documents on documents.id = versions.document_id
        where versions.storage_path = storage.objects.name
          and versions.status = 'published'
          and documents.status = 'published'
      )
    )
  );

create or replace function public.legal_admin_create_document(
  p_document_key text,
  p_name text,
  p_description text default null,
  p_document_type text default 'terms'
)
returns public.legal_documents
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.legal_documents;
begin
  if not public.is_admin() then raise exception 'Forbidden'; end if;

  insert into public.legal_documents (document_key, name, description, document_type, created_by)
  values (
    lower(btrim(p_document_key)),
    btrim(p_name),
    nullif(btrim(p_description), ''),
    lower(coalesce(nullif(btrim(p_document_type), ''), 'terms')),
    auth.uid()
  )
  returning * into result;

  return result;
end;
$$;

create or replace function public.legal_admin_update_document(
  p_document_id uuid,
  p_document_key text,
  p_name text,
  p_description text default null,
  p_document_type text default 'terms'
)
returns public.legal_documents
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.legal_documents;
begin
  if not public.is_admin() then raise exception 'Forbidden'; end if;

  update public.legal_documents
  set document_key = lower(btrim(p_document_key)),
      name = btrim(p_name),
      description = nullif(btrim(p_description), ''),
      document_type = lower(coalesce(nullif(btrim(p_document_type), ''), 'terms'))
  where id = p_document_id
    and status = 'draft'
  returning * into result;

  if result.id is null then raise exception 'Only draft documents can be edited'; end if;
  return result;
end;
$$;

create or replace function public.legal_admin_create_version(
  p_document_id uuid,
  p_version_label text,
  p_content text default null,
  p_storage_path text default null,
  p_mime_type text default null,
  p_content_sha256 text default null,
  p_effective_from timestamptz default now(),
  p_requires_reacceptance boolean default true
)
returns public.legal_document_versions
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.legal_document_versions;
  normalized_hash text := lower(btrim(coalesce(p_content_sha256, '')));
  normalized_path text := nullif(btrim(p_storage_path), '');
  normalized_content text := nullif(p_content, '');
begin
  if not public.is_admin() then raise exception 'Forbidden'; end if;
  if not exists (select 1 from public.legal_documents where id = p_document_id) then
    raise exception 'Legal document not found';
  end if;
  if normalized_content is null and normalized_path is null then
    raise exception 'Version requires text content or a stored file';
  end if;
  if normalized_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Version requires a SHA-256 hash';
  end if;
  if normalized_path is not null and normalized_path ~ '(^|/)\.\.?(/|$)' then
    raise exception 'Invalid storage path';
  end if;

  insert into public.legal_document_versions (
    document_id, version_label, content, storage_path, mime_type,
    content_sha256, effective_from, requires_reacceptance, created_by
  )
  values (
    p_document_id, btrim(p_version_label), normalized_content, normalized_path,
    nullif(btrim(p_mime_type), ''), normalized_hash,
    coalesce(p_effective_from, now()), coalesce(p_requires_reacceptance, true), auth.uid()
  )
  returning * into result;

  return result;
end;
$$;

create or replace function public.legal_admin_publish_version(p_version_id uuid)
returns public.legal_document_versions
language plpgsql
security definer
set search_path = public
as $$
declare
  target public.legal_document_versions;
begin
  if not public.is_admin() then raise exception 'Forbidden'; end if;

  select * into target
  from public.legal_document_versions
  where id = p_version_id
  for update;

  if target.id is null then raise exception 'Legal version not found'; end if;
  if target.status <> 'draft' then raise exception 'Only draft versions can be published'; end if;

  update public.legal_document_versions
  set status = 'archived'
  where document_id = target.document_id
    and status = 'published';

  update public.legal_document_versions
  set status = 'published',
      published_at = now(),
      effective_from = coalesce(effective_from, now())
  where id = p_version_id
  returning * into target;

  update public.legal_documents
  set status = 'published'
  where id = target.document_id;

  return target;
end;
$$;

create or replace function public.legal_admin_create_rule(
  p_document_id uuid,
  p_module_key text,
  p_action_key text default '*',
  p_role_key text default '*',
  p_account_type text default null,
  p_is_required boolean default true
)
returns public.legal_document_rules
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.legal_document_rules;
begin
  if not public.is_admin() then raise exception 'Forbidden'; end if;
  if not exists (select 1 from public.legal_documents where id = p_document_id) then
    raise exception 'Legal document not found';
  end if;

  insert into public.legal_document_rules (
    document_id, module_key, action_key, role_key, account_type, is_required
  )
  values (
    p_document_id,
    lower(btrim(p_module_key)),
    lower(coalesce(nullif(btrim(p_action_key), ''), '*')),
    lower(coalesce(nullif(btrim(p_role_key), ''), '*')),
    nullif(lower(btrim(p_account_type)), ''),
    coalesce(p_is_required, true)
  )
  returning * into result;

  return result;
end;
$$;

create or replace function public.legal_get_requirements(
  p_module_key text,
  p_action_key text default null,
  p_account_type text default null
)
returns table (
  document_id uuid,
  document_key text,
  name text,
  description text,
  document_type text,
  version_id uuid,
  version_label text,
  content text,
  storage_path text,
  mime_type text,
  content_sha256 text,
  effective_from timestamptz,
  requires_reacceptance boolean,
  rule_id uuid,
  module_key text,
  action_key text,
  role_key text,
  account_type text,
  is_required boolean,
  has_accepted boolean,
  accepted_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
with profile as (
  select coalesce(u.roles, '') as roles
  from public.users u
  where u.id = auth.uid()
  limit 1
), current_versions as (
  select distinct on (v.document_id)
    v.*
  from public.legal_document_versions v
  where v.status = 'published'
    and v.effective_from <= now()
  order by v.document_id, v.effective_from desc, v.published_at desc nulls last, v.created_at desc
)
select
  d.id,
  d.document_key,
  d.name,
  d.description,
  d.document_type,
  v.id,
  v.version_label,
  v.content,
  v.storage_path,
  v.mime_type,
  v.content_sha256,
  v.effective_from,
  v.requires_reacceptance,
  r.id,
  r.module_key,
  r.action_key,
  r.role_key,
  r.account_type,
  r.is_required,
  exists (
    select 1
    from public.legal_acceptances a
    where a.auth_user_id = auth.uid()
      and a.document_id = d.id
      and a.module_key = lower(btrim(coalesce(p_module_key, '')))
      and a.action_key = lower(btrim(coalesce(p_action_key, '')))
      and (a.version_id = v.id or not v.requires_reacceptance)
  ),
  (
    select max(a.accepted_at)
    from public.legal_acceptances a
    where a.auth_user_id = auth.uid()
      and a.document_id = d.id
      and a.module_key = lower(btrim(coalesce(p_module_key, '')))
      and a.action_key = lower(btrim(coalesce(p_action_key, '')))
      and (a.version_id = v.id or not v.requires_reacceptance)
  )
from public.legal_document_rules r
join public.legal_documents d on d.id = r.document_id and d.status = 'published'
join current_versions v on v.document_id = d.id
cross join profile
where r.is_active
  and lower(r.module_key) = lower(btrim(coalesce(p_module_key, '')))
  and (r.action_key = '*' or lower(r.action_key) = lower(btrim(coalesce(p_action_key, ''))))
  and (r.account_type is null or lower(r.account_type) = lower(btrim(coalesce(p_account_type, ''))))
  and (
    r.role_key = '*'
    or exists (
      select 1
      from unnest(string_to_array(lower(profile.roles), ',')) role_name
      where btrim(role_name) = lower(r.role_key)
    )
  )
order by d.name, v.effective_from desc;
$$;

create or replace function public.legal_accept_document(
  p_document_id uuid,
  p_version_id uuid,
  p_module_key text,
  p_action_key text default null,
  p_method text default 'checkbox',
  p_user_agent text default null,
  p_account_type text default null
)
returns public.legal_acceptances
language plpgsql
security definer
set search_path = public
as $$
declare
  current_version public.legal_document_versions;
  acceptance public.legal_acceptances;
  normalized_module text := lower(btrim(coalesce(p_module_key, '')));
  normalized_action text := lower(btrim(coalesce(p_action_key, '')));
  normalized_account_type text := lower(btrim(coalesce(p_account_type, '')));
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if normalized_module = '' then raise exception 'Module is required'; end if;

  select v.* into current_version
  from public.legal_document_versions v
  join public.legal_documents d on d.id = v.document_id and d.status = 'published'
  where v.document_id = p_document_id
    and v.id = p_version_id
    and v.status = 'published'
    and v.effective_from <= now()
  order by v.effective_from desc, v.published_at desc nulls last
  limit 1;

  if current_version.id is null then raise exception 'The legal version is not current'; end if;
  if not exists (
    select 1
    from public.legal_document_rules r
    join public.users u on u.id = auth.uid()
    where r.document_id = p_document_id
      and r.is_active
      and lower(r.module_key) = normalized_module
      and (r.action_key = '*' or lower(r.action_key) = normalized_action)
      and (r.account_type is null or lower(r.account_type) = normalized_account_type)
      and (
        r.role_key = '*'
        or exists (
          select 1
          from unnest(string_to_array(lower(coalesce(u.roles, '')), ',')) role_name
          where btrim(role_name) = lower(r.role_key)
        )
      )
  ) then
    raise exception 'The legal document is not applicable to this user';
  end if;

  insert into public.legal_acceptances as existing (
    auth_user_id, document_id, version_id, module_key, action_key,
    method, content_sha256, user_agent
  )
  values (
    auth.uid(), p_document_id, p_version_id, normalized_module, normalized_action,
    lower(coalesce(nullif(btrim(p_method), ''), 'checkbox')),
    current_version.content_sha256,
    left(nullif(btrim(p_user_agent), ''), 512)
  )
  on conflict (auth_user_id, version_id, module_key, action_key)
  do update set accepted_at = existing.accepted_at
  returning * into acceptance;

  return acceptance;
end;
$$;

create or replace function public.legal_admin_pending_users(p_document_id uuid)
returns table (
  auth_user_id uuid,
  display_name text,
  username text,
  email text,
  roles text,
  version_id uuid,
  version_label text,
  module_key text,
  action_key text
)
language sql
stable
security definer
set search_path = public
as $$
with current_version as (
  select v.*
  from public.legal_document_versions v
  where v.document_id = p_document_id
    and v.status = 'published'
    and v.effective_from <= now()
  order by v.effective_from desc, v.published_at desc nulls last, v.created_at desc
  limit 1
), applicable as (
  select distinct
    u.id as auth_user_id,
    u.display_name,
    u.username,
    u.email,
    u.roles,
    cv.id as version_id,
    cv.version_label,
    r.module_key,
    r.action_key
  from public.users u
  cross join current_version cv
  join public.legal_document_rules r on r.document_id = p_document_id and r.is_active and r.account_type is null
  where (
    r.role_key = '*'
    or exists (
      select 1
      from unnest(string_to_array(lower(coalesce(u.roles, '')), ',')) role_name
      where btrim(role_name) = lower(r.role_key)
    )
  )
)
select a.*
from applicable a
where not exists (
  select 1
  from public.legal_acceptances accepted
  where accepted.auth_user_id = a.auth_user_id
    and accepted.document_id = p_document_id
    and accepted.module_key = a.module_key
    and (a.action_key = '*' or accepted.action_key = a.action_key)
    and (accepted.version_id = a.version_id or not exists (
      select 1 from current_version current_v where current_v.requires_reacceptance = true
    ))
)
order by lower(coalesce(a.display_name, a.username, a.email, ''));
$$;

revoke all on function public.legal_admin_create_document(text, text, text, text) from public;
grant execute on function public.legal_admin_create_document(text, text, text, text) to authenticated;
revoke all on function public.legal_admin_update_document(uuid, text, text, text, text) from public;
grant execute on function public.legal_admin_update_document(uuid, text, text, text, text) to authenticated;
revoke all on function public.legal_admin_create_version(uuid, text, text, text, text, text, timestamptz, boolean) from public;
grant execute on function public.legal_admin_create_version(uuid, text, text, text, text, text, timestamptz, boolean) to authenticated;
revoke all on function public.legal_admin_publish_version(uuid) from public;
grant execute on function public.legal_admin_publish_version(uuid) to authenticated;
revoke all on function public.legal_admin_create_rule(uuid, text, text, text, text, boolean) from public;
grant execute on function public.legal_admin_create_rule(uuid, text, text, text, text, boolean) to authenticated;
revoke all on function public.legal_get_requirements(text, text, text) from public;
grant execute on function public.legal_get_requirements(text, text, text) to authenticated;
revoke all on function public.legal_accept_document(uuid, uuid, text, text, text, text, text) from public;
grant execute on function public.legal_accept_document(uuid, uuid, text, text, text, text, text) to authenticated;
revoke all on function public.legal_admin_pending_users(uuid) from public;
grant execute on function public.legal_admin_pending_users(uuid) to authenticated;

comment on table public.legal_documents is
  'Stable legal document identities. Content belongs to immutable legal_document_versions.';
comment on table public.legal_document_versions is
  'Immutable legal document versions. Published rows must be superseded, never edited in place.';
comment on table public.legal_document_rules is
  'Reusable module, action, role and account applicability rules for legal documents.';
comment on table public.legal_acceptances is
  'Server-timestamped affirmative acceptances tied to exact version hashes.';
