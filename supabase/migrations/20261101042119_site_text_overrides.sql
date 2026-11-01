-- Hidden Room web copy editor persistence.
-- Values are scoped by page and content key so the admin editor can upsert
-- only the copy it owns without exposing write access to regular users.

create table if not exists public.site_text_overrides (
  id uuid primary key default gen_random_uuid(),
  page_path text not null,
  content_key text not null,
  default_text text not null,
  override_text text,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint site_text_overrides_page_key_unique unique (page_path, content_key),
  constraint site_text_overrides_page_path_check check (left(page_path, 1) = '/'),
  constraint site_text_overrides_content_key_check check (length(btrim(content_key)) > 0),
  constraint site_text_overrides_override_text_check check (not is_active or override_text is not null)
);

create index if not exists site_text_overrides_active_page_idx
  on public.site_text_overrides (page_path, is_active);

drop trigger if exists site_text_overrides_set_updated_at on public.site_text_overrides;
create trigger site_text_overrides_set_updated_at
before update on public.site_text_overrides
for each row execute function public.set_updated_at();

alter table public.site_text_overrides enable row level security;

drop policy if exists "site text overrides admin all" on public.site_text_overrides;
create policy "site text overrides admin all"
  on public.site_text_overrides
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

grant select, insert, update, delete on public.site_text_overrides to authenticated;
