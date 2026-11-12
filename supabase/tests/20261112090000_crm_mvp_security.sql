-- Read-only CRM release checks. Run with a privileged test role, never in production from the browser.
select table_name from information_schema.tables
where table_schema = 'public'
  and table_name in ('sales_leads', 'sales_opportunities', 'sales_activities');

select tablename, policyname, cmd
from pg_policies
where schemaname = 'public'
  and tablename in ('sales_leads', 'sales_opportunities', 'sales_activities')
order by tablename, policyname;

select relname, relrowsecurity
from pg_class
where relnamespace = 'public'::regnamespace
  and relname in ('sales_leads', 'sales_opportunities', 'sales_activities');
