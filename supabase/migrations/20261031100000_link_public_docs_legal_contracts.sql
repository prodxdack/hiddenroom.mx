-- Link the current PDFs published in Raíz Cloud /docs to the legal
-- acceptance flow used by Beat Store producer onboarding and review.
-- The URLs and hashes identify the exact public files without copying them
-- into Supabase Storage.

do $$
declare
  v_beatstore_id uuid := '00000000-0000-4000-8000-00000000e200';
  v_hiddenroom_terms_id uuid := '00000000-0000-4000-8000-00000000e210';
  v_privacy_id uuid := '00000000-0000-4000-8000-00000000e220';
begin
  insert into public.legal_documents (
    id, document_key, name, description, document_type, status
  ) values (
    v_beatstore_id,
    'beatstore-producer-terms',
    'Términos y condiciones de Beat Store',
    'Documento oficial vigente para productores de Beat Store.',
    'contract',
    'published'
  )
  on conflict (document_key) do update set
    name = excluded.name,
    description = excluded.description,
    document_type = excluded.document_type,
    status = 'published';

  insert into public.legal_documents (
    id, document_key, name, description, document_type, status
  ) values (
    v_hiddenroom_terms_id,
    'hiddenroom-terms',
    'Términos y condiciones de uso de Hidden Room',
    'Condiciones generales aplicables al uso de Hidden Room.',
    'terms',
    'published'
  )
  on conflict (document_key) do update set
    name = excluded.name,
    description = excluded.description,
    document_type = excluded.document_type,
    status = 'published';

  insert into public.legal_documents (
    id, document_key, name, description, document_type, status
  ) values (
    v_privacy_id,
    'hiddenroom-privacy',
    'Aviso y política de privacidad de Hidden Room',
    'Aviso de privacidad aplicable al tratamiento de datos personales en Hidden Room.',
    'policy',
    'published'
  )
  on conflict (document_key) do update set
    name = excluded.name,
    description = excluded.description,
    document_type = excluded.document_type,
    status = 'published';

  -- The Beat Store file was replaced in Raíz Cloud. A new immutable version
  -- intentionally requires re-acceptance from users who accepted version 1.0.
  if not exists (
    select 1 from public.legal_document_versions
    where document_id = v_beatstore_id and version_label = '1.1'
  ) then
    insert into public.legal_document_versions (
      id, document_id, version_label, storage_path, mime_type,
      content_sha256, status, published_at, effective_from,
      requires_reacceptance
    ) values (
      '00000000-0000-4000-8000-00000000e202',
      v_beatstore_id,
      '1.1',
      'https://cloud.mysauth.com/api/public-docs/file?name=15111%20T%C3%A9rminos%20y%20Condiciones%20de%20Uso%20Beat%20Store.pdf&mode=view',
      'application/pdf',
      '4b860b4aa15345ba481680c92ad93bf3389e0a320142b2bcc2bf14cde6c6088e',
      'published',
      now(),
      now(),
      true
    );
  end if;

  update public.legal_document_versions
  set status = 'archived'
  where document_id = v_beatstore_id
    and status = 'published'
    and version_label <> '1.1';

  if not exists (
    select 1 from public.legal_document_versions
    where document_id = v_hiddenroom_terms_id and version_label = '1.0'
  ) then
    insert into public.legal_document_versions (
      id, document_id, version_label, storage_path, mime_type,
      content_sha256, status, published_at, effective_from,
      requires_reacceptance
    ) values (
      '00000000-0000-4000-8000-00000000e211',
      v_hiddenroom_terms_id,
      '1.0',
      'https://cloud.mysauth.com/api/public-docs/file?name=15111%20T%C3%A9rminos%20y%20Condiciones%20de%20Uso%20HIDDENROOM.MX.pdf&mode=view',
      'application/pdf',
      '94634540974c1d9d7f4bf3ff1d84eb8c92b4e9db9f2244ba6b68081886b0ca1c',
      'published',
      now(),
      now(),
      true
    );
  end if;

  if not exists (
    select 1 from public.legal_document_versions
    where document_id = v_privacy_id and version_label = '1.0'
  ) then
    insert into public.legal_document_versions (
      id, document_id, version_label, storage_path, mime_type,
      content_sha256, status, published_at, effective_from,
      requires_reacceptance
    ) values (
      '00000000-0000-4000-8000-00000000e221',
      v_privacy_id,
      '1.0',
      'https://cloud.mysauth.com/api/public-docs/file?name=15112%20Aviso%20y%20Pol%C3%ADtica%20de%20Privacidad%20HIDDENROOM.MX.pdf&mode=view',
      'application/pdf',
      '7fded647ef4558cb045353aa0e4f58803cff2356e659b4c5416097acd2983ba3',
      'published',
      now(),
      now(),
      true
    );
  end if;

  -- The invitation and the producer review gate accept the same complete
  -- onboarding package: Beat Store terms, general terms and privacy notice.
  -- account_type is nullable, so the table's UNIQUE constraint does not
  -- consider two NULL account types equal. Use IS NOT DISTINCT FROM to keep
  -- this forward migration idempotent with the original Beat Store seed.
  insert into public.legal_document_rules (
    document_id, module_key, action_key, role_key, account_type,
    is_required, is_active
  )
  select v.document_id, v.module_key, v.action_key, v.role_key,
         v.account_type, true, true
  from (values
    (v_beatstore_id, 'beatstore'::text, 'publish_beat'::text, '*'::text, null::text),
    (v_hiddenroom_terms_id, 'beatstore'::text, 'publish_beat'::text, '*'::text, null::text),
    (v_privacy_id, 'beatstore'::text, 'publish_beat'::text, '*'::text, null::text)
  ) as v(document_id, module_key, action_key, role_key, account_type)
  where not exists (
    select 1
    from public.legal_document_rules existing
    where existing.document_id = v.document_id
      and existing.module_key = v.module_key
      and existing.action_key = v.action_key
      and existing.role_key = v.role_key
      and existing.account_type is not distinct from v.account_type
  );

  update public.legal_document_rules
  set is_required = true, is_active = true
  where document_id in (v_beatstore_id, v_hiddenroom_terms_id, v_privacy_id)
    and module_key = 'beatstore'
    and action_key = 'publish_beat'
    and role_key = '*'
    and account_type is null;
end;
$$;
