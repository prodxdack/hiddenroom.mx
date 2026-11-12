-- Hidden Room CRM MVP: preserve existing sales data and restrict CRM access to admins.

create table if not exists public.sales_leads (
  id uuid primary key default gen_random_uuid(),
  user_id text,
  display_name text not null,
  whatsapp text,
  instagram text,
  source text,
  business_unit text not null default 'studio',
  first_seen_at timestamptz,
  first_inbound_at timestamptz,
  first_outbound_at timestamptz,
  first_purchase_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sales_opportunities (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.sales_leads(id) on delete restrict,
  business_unit text not null default 'studio',
  service text,
  kind text not null default 'acquisition',
  stage text not null default 'prospect',
  estimated_amount numeric(12,2),
  currency text not null default 'MXN',
  source text,
  next_followup_at timestamptz,
  closed_at timestamptz,
  lost_reason text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sales_opportunities_kind_check check (kind in ('acquisition','reactivation','upsell','renewal')),
  constraint sales_opportunities_stage_check check (stage in ('prospect','contacted','interested','quoted','reserved','won','lost','paused'))
);

create table if not exists public.sales_activities (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.sales_leads(id) on delete restrict,
  opportunity_id uuid references public.sales_opportunities(id) on delete set null,
  occurred_at timestamptz not null default now(),
  channel text not null,
  direction text not null,
  activity_type text not null default 'message',
  summary text,
  outcome text,
  responsible text,
  next_action text,
  next_followup_at timestamptz,
  external_message_ref text,
  created_at timestamptz not null default now(),
  constraint sales_activities_direction_check check (direction in ('inbound','outbound','internal'))
);

create index if not exists sales_leads_source_idx on public.sales_leads(source);
create index if not exists sales_opportunities_stage_idx on public.sales_opportunities(stage);
create index if not exists sales_opportunities_source_idx on public.sales_opportunities(source);
create index if not exists sales_activities_next_followup_idx on public.sales_activities(next_followup_at);

alter table public.sales_leads enable row level security;
alter table public.sales_opportunities enable row level security;
alter table public.sales_activities enable row level security;

do $$
declare
  policy_row record;
begin
  for policy_row in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('sales_leads', 'sales_opportunities', 'sales_activities')
  loop
    execute format('drop policy if exists %I on %I.%I', policy_row.policyname, policy_row.schemaname, policy_row.tablename);
  end loop;
end;
$$;

create policy crm_admin_all_leads on public.sales_leads
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy crm_admin_all_opportunities on public.sales_opportunities
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy crm_admin_all_activities on public.sales_activities
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

revoke all on public.sales_leads, public.sales_opportunities, public.sales_activities from anon;
revoke all on public.sales_leads, public.sales_opportunities, public.sales_activities from public;
grant select, insert, update, delete on public.sales_leads, public.sales_opportunities, public.sales_activities to authenticated;
grant all on public.sales_leads, public.sales_opportunities, public.sales_activities to service_role;
