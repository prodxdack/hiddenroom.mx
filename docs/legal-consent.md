# Documentos legales y aceptaciones

## Qué se implementó

El sistema separa cuatro conceptos:

1. `legal_documents`: identidad estable del documento (`document_key`, nombre, tipo y estado).
2. `legal_document_versions`: versiones inmutables con contenido o ruta PDF, vigencia y hash SHA-256.
3. `legal_document_rules`: reglas reutilizables por módulo, acción, rol y tipo de cuenta.
4. `legal_acceptances`: evidencia de la aceptación afirmativa del usuario, versión exacta, hash, contexto y timestamp del servidor.

La migración es:

`supabase/migrations/20261030110000_legal_documents_consent.sql`

El sistema no crea contenido legal de negocio por sí mismo. El administrador debe crear el documento y publicar su primera versión desde Portal > ERP / Operaciones > Documentos legales.

## Componentes

- Servicio reutilizable: `assets/js/legal-service.js`.
- Gate responsive de aceptación: `assets/css/legal.css` y `openLegalAcceptanceGate()`.
- Administración: sección `erp-legal` en `portal/dashboard.js`.
- Integración inicial: `store/beat_store/new-beat.js`; antes de enviar un beat a revisión consulta los requisitos de `beatstore / publish_beat`.
- Invitación de Beat Store: `store/beat_store/producer-invite.js`; si existe una regla publicada para ese contexto, registra la aceptación al aceptar la invitación.

## Crear el contrato de productores de Beat Store

1. Entra al Portal como administrador.
2. Abre `ERP / Operaciones > Documentos legales`.
3. Crea un documento con un identificador estable como `beatstore-producer-terms`.
4. Crea una versión desde texto o PDF. El sistema calcula el hash SHA-256 y guarda la versión como borrador.
5. Revisa y publica la versión desde el historial.
6. Crea una regla con:
   - Módulo: `beatstore`
   - Acción: `publish_beat`
   - Rol: `*` o el rol operativo correspondiente
   - “Bloquear la acción hasta aceptar”: activado

Al intentar enviar un beat a revisión, el productor verá el gate únicamente si tiene una aceptación pendiente.

## RPCs

- `legal_get_requirements(module, action, account_type)`: resuelve requisitos y estado de aceptación.
- `legal_accept_document(document_id, version_id, module, action, method, user_agent)`: verifica la versión publicada y registra la aceptación con `auth.uid()` y `now()` del servidor.
- `legal_admin_create_document(...)` y `legal_admin_update_document(...)`: gestionan identidades en borrador.
- `legal_admin_create_version(...)`: crea una versión nueva sin modificar versiones anteriores.
- `legal_admin_publish_version(version_id)`: archiva la publicación anterior y publica la nueva.
- `legal_admin_create_rule(...)`: registra reglas de aplicación.
- `legal_admin_pending_users(document_id)`: lista usuarios con aceptación pendiente de la versión publicada.

Las tablas de aceptación no permiten inserts directos desde el navegador; la escritura pasa por el RPC validado. Los PDFs se guardan en el bucket privado `legal-documents`.

## Pruebas

Prueba SQL local:

`supabase/tests/legal_documents_consent.sql`

Validaciones frontend:

```powershell
node --check assets/js/legal-service.js
node --check portal/dashboard.js
node --check store/beat_store/new-beat.js
node --check store/beat_store/producer-invite.js
git diff --check
```

La migración y el test deben ejecutarse contra Supabase Local antes de aplicar la migración al proyecto de producción. Este entorno no tenía la CLI local disponible, por lo que la prueba de RLS, grants y RPCs queda pendiente de ejecutarse con Supabase Local.

## Despliegue y rollback

El frontend puede publicarse junto con la migración, pero el flujo de Beat Store mantiene compatibilidad temporal si el RPC legal todavía no existe. Para habilitar el gate real hay que aplicar la migración en el proyecto correcto después de verificar backup, restauración, pruebas de roles y aprobación explícita.

Rollback recomendado:

1. Desactivar las reglas activas desde Portal o dejar de publicar nuevas versiones.
2. Revertir el frontend a la versión anterior si el gate presenta problemas.
3. Conservar `legal_acceptances`, documentos y versiones como evidencia histórica.
4. Solo eliminar tablas, bucket o funciones después de un backup verificable, una restauración ensayada y una migración de rollback revisada.
