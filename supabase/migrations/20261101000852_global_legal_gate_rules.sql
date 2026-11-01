-- Separate general Hidden Room acceptance from Beat Store acceptance.
-- The global gate covers general terms and privacy; Beat Store covers only
-- the Beat Store producer terms.

do $$
declare
  v_beatstore_id uuid;
  v_hiddenroom_terms_id uuid;
  v_privacy_id uuid;
begin
  select id into v_beatstore_id
  from public.legal_documents
  where document_key = 'beatstore-producer-terms';

  select id into v_hiddenroom_terms_id
  from public.legal_documents
  where document_key = 'hiddenroom-terms';

  select id into v_privacy_id
  from public.legal_documents
  where document_key = 'hiddenroom-privacy';

  if v_beatstore_id is null or v_hiddenroom_terms_id is null or v_privacy_id is null then
    raise exception 'Required legal documents are missing before global gate migration';
  end if;

  insert into public.legal_document_rules (
    document_id, module_key, action_key, role_key, account_type,
    is_required, is_active
  )
  select v.document_id, v.module_key, v.action_key, '*', null, true, true
  from (values
    (v_hiddenroom_terms_id, 'global'::text, 'site_access'::text),
    (v_privacy_id, 'global'::text, 'site_access'::text)
  ) as v(document_id, module_key, action_key)
  where not exists (
    select 1
    from public.legal_document_rules existing
    where existing.document_id = v.document_id
      and existing.module_key = v.module_key
      and existing.action_key = v.action_key
      and existing.role_key = '*'
      and existing.account_type is null
  );

  update public.legal_document_rules
  set is_required = true,
      is_active = true
  where document_id in (v_hiddenroom_terms_id, v_privacy_id)
    and module_key = 'global'
    and action_key = 'site_access'
    and role_key = '*'
    and account_type is null;

  update public.legal_document_rules
  set is_required = false,
      is_active = false
  where document_id in (v_hiddenroom_terms_id, v_privacy_id)
    and module_key = 'beatstore'
    and action_key = 'publish_beat'
    and role_key = '*'
    and account_type is null;

  update public.legal_document_rules
  set is_required = true,
      is_active = true
  where document_id = v_beatstore_id
    and module_key = 'beatstore'
    and action_key = 'publish_beat'
    and role_key = '*'
    and account_type is null;
end;
$$;
