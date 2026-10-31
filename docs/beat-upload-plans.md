# Planes y límites de subida de Beat Store

## Modelo

La migración `supabase/migrations/20261031022038_beat_upload_plans.sql` crea `public.beat_upload_access` con el plan (`socio_embajador` o `pago`) y el límite de beats no inactivos que puede mantener cada productor.

Los permisos legacy `beats.upload`, `beats.upload.plan.*` y `beats.upload.limit.*` se conservan y se sincronizan para que las versiones anteriores del frontend sigan funcionando.

## Flujo administrativo

En Beat Store, el administrador selecciona el plan y el límite. El frontend usa `admin_set_beat_upload_access()` para guardar la configuración de forma atómica y enviar la invitación. Revocar acceso usa `admin_revoke_beat_upload_access()`.

## Aplicación del límite

`beat_upload_quota_available()` y el trigger `enforce_beat_upload_quota` bloquean la creación o reactivación de beats cuando el productor ya alcanzó su límite. Los beats `inactive` no consumen espacio; al inactivar uno se libera un lugar.

La cuota se comprueba con bloqueo transaccional por productor para evitar que dos subidas simultáneas rebasen el límite.

## Pruebas

`supabase/tests/beat_upload_plans.sql` cubre asignación, lectura, RLS, creación de beats, límite, reutilización de espacio y revocación. Junto con las pruebas legales, el arnés local terminó con `55/55` pruebas exitosas.
