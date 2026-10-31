-- Existing public Beat Store PDF is the only seeded legal requirement.
begin;
select plan(5);

select is((select count(*)::integer from public.legal_documents where document_key = 'beatstore-producer-terms'), 1, 'Beat Store terms document is registered');
select is((select count(*)::integer from public.legal_document_versions v join public.legal_documents d on d.id = v.document_id where d.document_key = 'beatstore-producer-terms' and v.status = 'published'), 1, 'Beat Store terms version is published');
select is((select storage_path from public.legal_document_versions v join public.legal_documents d on d.id = v.document_id where d.document_key = 'beatstore-producer-terms' and v.status = 'published'), 'https://cloud.mysauth.com/api/public-docs/file?name=12126%20T%C3%A9rminos%20y%20Condiciones%20de%20Uso%20Beat%20Store.pdf&mode=view', 'published version points to the existing public PDF');
select is((select count(*)::integer from public.legal_document_rules r join public.legal_documents d on d.id = r.document_id where d.document_key = 'beatstore-producer-terms' and r.module_key = 'beatstore' and r.action_key = 'publish_beat' and r.is_required and r.is_active), 1, 'Beat Store acceptance rule is required and active');
select is((select count(*)::integer from public.legal_documents where document_key like '%privacy%'), 0, 'privacy policy remains pending');

select * from finish();
rollback;
