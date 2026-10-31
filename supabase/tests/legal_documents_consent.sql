-- Reusable legal documents contract. Synthetic/schema-only assertions.
-- Run against Supabase Local after 20261030110000_legal_documents_consent.sql.
begin;
select plan(16);

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

select * from finish();
rollback;
