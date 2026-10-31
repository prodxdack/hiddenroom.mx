-- Register the existing public Raíz Cloud PDF as the first required
-- Beat Store producer document. Privacy remains intentionally unconfigured.
do $$
declare
  v_document_id uuid;
begin
  select d.id into v_document_id
  from public.legal_documents d
  where d.document_key = 'beatstore-producer-terms';

  if v_document_id is null then
    insert into public.legal_documents (
      id, document_key, name, description, document_type, status
    ) values (
      '00000000-0000-4000-8000-00000000e200',
      'beatstore-producer-terms',
      'Términos y condiciones de Beat Store',
      'Documento oficial vigente para productores de Beat Store.',
      'contract',
      'published'
    )
    returning id into v_document_id;
  else
    update public.legal_documents
    set name = 'Términos y condiciones de Beat Store',
        description = 'Documento oficial vigente para productores de Beat Store.',
        document_type = 'contract',
        status = 'published'
    where id = v_document_id and status = 'draft';
  end if;

  if not exists (
    select 1 from public.legal_document_versions v
    where v.document_id = v_document_id and v.version_label = '1.0'
  ) then
    insert into public.legal_document_versions (
      id, document_id, version_label, storage_path, mime_type,
      content_sha256, status, published_at, effective_from,
      requires_reacceptance
    ) values (
      '00000000-0000-4000-8000-00000000e201',
      v_document_id,
      '1.0',
      'https://cloud.mysauth.com/api/public-docs/file?name=12126%20T%C3%A9rminos%20y%20Condiciones%20de%20Uso%20Beat%20Store.pdf&mode=view',
      'application/pdf',
      'a4f3d4f6003d2f324e745de212e7bab1800e92d76004490375c35afcf29db6d4',
      'published',
      now(),
      now(),
      true
    );
  end if;

  insert into public.legal_document_rules (
    document_id, module_key, action_key, role_key, account_type,
    is_required, is_active
  ) values (
    v_document_id, 'beatstore', 'publish_beat', '*', null, true, true
  )
  on conflict (document_id, module_key, action_key, role_key, account_type)
  do update set is_required = true, is_active = true;
end;
$$;
