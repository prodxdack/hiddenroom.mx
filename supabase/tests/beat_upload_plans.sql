-- Structured producer plans and quota assertions.
-- Run against Supabase Local after 20261031022038_beat_upload_plans.sql.
begin;
select plan(26);

select has_table('public', 'beat_upload_access', 'producer access table exists');
select has_column('public', 'beat_upload_access', 'plan_key', 'producer plan exists');
select has_column('public', 'beat_upload_access', 'upload_limit', 'producer upload limit exists');
select ok(to_regprocedure('public.beat_upload_access_config(uuid)') is not null, 'access config RPC exists');
select ok(to_regprocedure('public.beat_upload_quota_available(uuid,uuid)') is not null, 'quota RPC exists');
select ok(to_regprocedure('public.admin_set_beat_upload_access(uuid,text,integer)') is not null, 'admin set access RPC exists');
select ok(to_regprocedure('public.admin_revoke_beat_upload_access(uuid)') is not null, 'admin revoke access RPC exists');
select ok(exists (
  select 1
  from pg_trigger
  where tgrelid = 'public.store_products'::regclass
    and tgname = 'enforce_beat_upload_quota'
), 'quota trigger exists');
select ok(not has_table_privilege('authenticated', 'public.beat_upload_access', 'INSERT'), 'producer cannot write access table directly');
select ok(has_function_privilege('authenticated', 'public.admin_set_beat_upload_access(uuid,text,integer)', 'execute'), 'authenticated can call guarded admin RPC');
select ok(not has_function_privilege('anon', 'public.admin_set_beat_upload_access(uuid,text,integer)', 'execute'), 'anon cannot call admin RPC');

insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-4000-8000-00000000b001', 'authenticated', 'authenticated', 'beat-admin@example.test', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-4000-8000-00000000b002', 'authenticated', 'authenticated', 'beat-producer@example.test', '{}'::jsonb, '{}'::jsonb, now(), now());

insert into public.users (id, user_id, display_name, email, username, roles, has_auth)
values
  ('00000000-0000-4000-8000-00000000b001', '00000000-0000-4000-8000-00000000b001', 'Beat Admin', 'beat-admin@example.test', 'beat-admin', 'admin', true),
  ('00000000-0000-4000-8000-00000000b002', '00000000-0000-4000-8000-00000000b002', 'Beat Producer', 'beat-producer@example.test', 'beat-producer', 'client', true);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000b001', true);

select ok((select plan_key = 'pago' and upload_limit = 2
  from public.admin_set_beat_upload_access(
    '00000000-0000-4000-8000-00000000b002', 'pago', 2
  )), 'admin can assign plan and quota');

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000b002', true);
select is((select plan_key from public.beat_upload_access_config()), 'pago', 'producer sees assigned plan');
select is((select upload_limit from public.beat_upload_access_config()), 2, 'producer sees assigned limit');
select is((select remaining_uploads from public.beat_upload_access_config()), 2, 'producer starts with two available uploads');
select ok(public.has_beats_upload_permission(), 'assigned producer has upload permission');

select lives_ok($$
  insert into public.store_products (slug, name, category, price, is_active, publication_status, producer_user_id)
  values ('quota-beat-one', 'Quota Beat One', 'beats', 100, false, 'draft', '00000000-0000-4000-8000-00000000b002')
$$, 'producer can create first draft');
select lives_ok($$
  insert into public.store_products (slug, name, category, price, is_active, publication_status, producer_user_id)
  values ('quota-beat-two', 'Quota Beat Two', 'beats', 100, false, 'draft', '00000000-0000-4000-8000-00000000b002')
$$, 'producer can create second draft');
select is((select remaining_uploads from public.beat_upload_access_config()), 0, 'quota reaches zero after two drafts');
select throws_ok($$
  insert into public.store_products (slug, name, category, price, is_active, publication_status, producer_user_id)
  values ('quota-beat-three', 'Quota Beat Three', 'beats', 100, false, 'draft', '00000000-0000-4000-8000-00000000b002')
$$, 'P0001', null, 'producer cannot exceed assigned quota');

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000b001', true);
update public.store_products
set publication_status = 'inactive', is_active = false
where slug = 'quota-beat-one';

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000b002', true);
select lives_ok($$
  insert into public.store_products (slug, name, category, price, is_active, publication_status, producer_user_id)
  values ('quota-beat-three', 'Quota Beat Three', 'beats', 100, false, 'draft', '00000000-0000-4000-8000-00000000b002')
$$, 'producer can reuse a slot after a beat is inactive');
select is((select used_uploads from public.beat_upload_access_config()), 2, 'only non-inactive beats count toward quota');
select is((select remaining_uploads from public.beat_upload_access_config()), 0, 'reused slot is consumed');

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000b001', true);
select lives_ok($$select public.admin_revoke_beat_upload_access('00000000-0000-4000-8000-00000000b002')$$, 'admin can revoke access');
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000b002', true);
select ok(not public.has_beats_upload_permission(), 'revoked producer loses upload permission');
select throws_ok($$
  insert into public.store_products (slug, name, category, price, is_active, publication_status, producer_user_id)
  values ('quota-beat-four', 'Quota Beat Four', 'beats', 100, false, 'draft', '00000000-0000-4000-8000-00000000b002')
$$, 'P0001', null, 'revoked producer cannot create a draft');

select * from finish();
rollback;
