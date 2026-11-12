-- Roll back only the CRM access layer. Data is preserved.
drop policy if exists crm_admin_all_leads on public.sales_leads;
drop policy if exists crm_admin_all_opportunities on public.sales_opportunities;
drop policy if exists crm_admin_all_activities on public.sales_activities;
revoke all on public.sales_leads, public.sales_opportunities, public.sales_activities from authenticated;
grant all on public.sales_leads, public.sales_opportunities, public.sales_activities to anon, authenticated, service_role;
alter table public.sales_leads enable row level security;
alter table public.sales_opportunities enable row level security;
alter table public.sales_activities enable row level security;
