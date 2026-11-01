begin;

select plan(4);

select is(
  (
    select count(*)::integer
    from public.legal_document_rules r
    join public.legal_documents d on d.id = r.document_id
    where d.document_key in ('hiddenroom-terms', 'hiddenroom-privacy')
      and r.module_key = 'global'
      and r.action_key = 'site_access'
      and r.role_key = '*'
      and r.is_required
      and r.is_active
  ),
  2,
  'global site access requires general terms and privacy'
);

select is(
  (
    select count(*)::integer
    from public.legal_document_rules r
    join public.legal_documents d on d.id = r.document_id
    where d.document_key in ('hiddenroom-terms', 'hiddenroom-privacy')
      and r.module_key = 'beatstore'
      and r.action_key = 'publish_beat'
      and r.is_active
  ),
  0,
  'Beat Store no longer requires general documents'
);

select is(
  (
    select count(*)::integer
    from public.legal_document_rules r
    join public.legal_documents d on d.id = r.document_id
    where d.document_key = 'beatstore-producer-terms'
      and r.module_key = 'beatstore'
      and r.action_key = 'publish_beat'
      and r.is_required
      and r.is_active
  ),
  1,
  'Beat Store requires its own terms only'
);

select ok(
  not exists (
    select 1
    from public.legal_document_rules r
    join public.legal_documents d on d.id = r.document_id
    where d.document_key in ('hiddenroom-terms', 'hiddenroom-privacy')
      and r.module_key = 'beatstore'
      and r.action_key = 'publish_beat'
      and r.is_active
  ),
  'general legal rules are inactive in Beat Store'
);

select * from finish();
rollback;
