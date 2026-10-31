-- Reusable legal documents contract. Synthetic/schema-only assertions.
-- Run against Supabase Local after 20261030110000_legal_documents_consent.sql.
begin;
select plan(29);

select has_table('public', 'legal_documents', 'legal documents table exists');
select has_table('public', 'legal_document_versions', 'legal versions table exists');
select has_table('public', 'legal_document_rules', 'legal rules table exists');
select has_table('public', 'legal_acceptances', 'legal acceptances table exists');
select has_column('public', 'legal_document_versions', 'content_sha256', 'version hash exists');
select has_column('public', 'legal_acceptances', 'accepted_at', 'server acceptance timestamp exists');
select ok(to_regprocedure('public.legal_get_requirements(text,text,text)') is not null, 'requirements RPC exists');
select ok(to_regprocedure('public.legal_accept_document(uuid,uuid,text,text,text,text,text)') is not null, 'acceptance RPC exists');
select ok(to_regprocedure('public.legal_admin_publish_version(uuid)') is not null, 'publish RPC exists');
select ok(to_regprocedure('public.legal_admin_pending_users(uuid)') is not null, 'pending users RPC exists');
select ok(exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'legal_accept_document' and p.prosecdef), 'acceptance RPC is SECURITY DEFINER');
select ok(exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'legal_accept_document' and p.proconfig @> array['search_path=public']), 'acceptance RPC pins search_path');
select ok(not has_table_privilege('anon', 'public.legal_acceptances', 'INSERT'), 'anon cannot insert acceptances directly');
select ok(not has_table_privilege('authenticated', 'public.legal_acceptances', 'INSERT'), 'authenticated cannot insert acceptances directly');
select ok(has_function_privilege('authenticated', 'public.legal_accept_document(uuid,uuid,text,text,text,text,text)', 'execute'), 'authenticated can use the guarded acceptance RPC');
select ok(not has_function_privilege('anon', 'public.legal_accept_document(uuid,uuid,text,text,text,text,text)', 'execute'), 'anon cannot use the acceptance RPC');

-- Synthetic authenticated users exercise applicability, server-side identity,
-- duplicate prevention and cross-user RLS without touching production data.
insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-4000-8000-00000000e001', 'authenticated', 'authenticated', 'legal-client-a@example.test', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-4000-8000-00000000e002', 'authenticated', 'authenticated', 'legal-client-b@example.test', '{}'::jsonb, '{}'::jsonb, now(), now());

insert into public.users (id, display_name, email, username, roles, has_auth)
values
  ('00000000-0000-4000-8000-00000000e001', 'Legal Client A', 'legal-client-a@example.test', 'legal-client-a', 'client', true),
  ('00000000-0000-4000-8000-00000000e002', 'Legal Client B', 'legal-client-b@example.test', 'legal-client-b', 'client', true);

insert into public.legal_documents (id, document_key, name, document_type, status)
values (
  '00000000-0000-4000-8000-00000000e101',
  'synthetic-producer-terms',
  'Synthetic producer terms',
  'contract',
  'published'
);

insert into public.legal_document_versions (
  id, document_id, version_label, content, content_sha256, status, published_at, effective_from
)
values (
  '00000000-0000-4000-8000-00000000e102',
  '00000000-0000-4000-8000-00000000e101',
  '1.0',
  'Synthetic legal content',
  repeat('a', 64),
  'published',
  now(),
  now()
);

insert into public.legal_document_rules (document_id, module_key, action_key, role_key, is_required)
values ('00000000-0000-4000-8000-00000000e101', 'testlegal', 'accept_test', 'client', true);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000e001', true);

select is((select count(*)::integer from public.legal_get_requirements('testlegal', 'accept_test')), 1, 'client sees the applicable published requirement');
select is((select bool_and(not has_accepted) from public.legal_get_requirements('testlegal', 'accept_test')), true, 'new client is pending before acceptance');

select ok((select id is not null from public.legal_accept_document(
  '00000000-0000-4000-8000-00000000e101',
  '00000000-0000-4000-8000-00000000e102',
  'testlegal',
  'accept_test',
  'checkbox',
  'synthetic-test-agent',
  null
)), 'acceptance RPC returns a server-created acceptance');
select is((select count(*)::integer from public.legal_acceptances), 1, 'accepted version is visible to its owner');
select is((select bool_and(has_accepted) from public.legal_get_requirements('testlegal', 'accept_test')), true, 'accepted client is no longer pending');

select ok((select id is not null from public.legal_accept_document(
  '00000000-0000-4000-8000-00000000e101',
  '00000000-0000-4000-8000-00000000e102',
  'testlegal',
  'accept_test',
  'checkbox',
  'synthetic-test-agent',
  null
)), 'repeated acceptance is idempotent');
select is((select count(*)::integer from public.legal_acceptances), 1, 'repeated acceptance does not duplicate evidence');

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000e002', true);
select is((select bool_and(not has_accepted) from public.legal_get_requirements('testlegal', 'accept_test')), true, 'second client remains pending independently');
select is((select count(*)::integer from public.legal_acceptances), 0, 'second client cannot read first client acceptance');

select throws_ok(
  $$insert into public.legal_acceptances (auth_user_id, document_id, version_id, module_key, action_key, method, content_sha256)
    values ('00000000-0000-4000-8000-00000000e002', '00000000-0000-4000-8000-00000000e101', '00000000-0000-4000-8000-00000000e102', 'testlegal', 'accept_test', 'checkbox', repeat('b', 64))$$,
  '42501', null, 'authenticated cannot insert acceptance evidence directly'
);

set local role postgres;
set local role service_role;
select throws_ok(
  $$update public.legal_document_versions set content = 'tampered' where id = '00000000-0000-4000-8000-00000000e102'$$,
  'P0001', null, 'published version content cannot be modified'
);
select throws_ok(
  $$delete from public.legal_acceptances where auth_user_id = '00000000-0000-4000-8000-00000000e001'$$,
  'P0001', null, 'acceptance history cannot be deleted'
);
set local role postgres;
select is((select count(*)::integer from public.legal_acceptances), 1, 'only client A acceptance exists in the synthetic fixture');

select * from finish();
rollback;
