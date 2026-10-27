# Migraciones

Cambios de esquema posteriores a `schema.sql`. **`schema.sql` y `seed.sql` no se modifican.**

## Convenciones
- Archivos numerados en orden: `001_descripcion.sql`, `002_descripcion.sql`, ...
- SQL **idempotente**: `CREATE TABLE IF NOT EXISTS`, `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`. Debe poder ejecutarse más de una vez sin error.
- Una migración por cambio; nunca editar una ya aplicada, crear una nueva.

## Local (`powerbuilding_dev`)
Aplicar en orden: `schema.sql`, `seed.sql` y luego cada migración:

```
& "C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -d powerbuilding_dev -f web/backend/src/db/schema.sql
& "C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -d powerbuilding_dev -f web/backend/src/db/seed.sql
& "C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -d powerbuilding_dev -f web/backend/src/db/migrations/001_xxx.sql
```

## Producción
Se aplican **a mano** por el responsable del proyecto. No se ejecutan desde el código ni desde Claude.

## Migraciones existentes
| Archivo | Contenido |
|---|---|
| `001_disciplinas_instructores.sql` | Tablas `disciplinas` (con 3 filas iniciales) e `instructores`; columnas opcionales `bloques.disciplina_id` e `instructor_id`. Solo agrega. |
| `002_planes_pagos_plantillas.sql` | Tablas `planes`, `pagos` (FK a `clientes` y `planes`) y `plantillas_notificacion` (con 3 plantillas iniciales). Sin planes ni precios de ejemplo. Solo agrega. |
| `003_notificaciones_log.sql` | Tabla `notificaciones_log` (registro de correos y recordatorios, con `clave_unica` para no duplicar envíos). |
| `004_pagos_online.sql` | Pago en línea (Webpay): método `webpay` y `pagos.origen`, tablas `transacciones_pago` y `documentos_pago`, plantilla `pago_confirmado`. |
| `005_mi_cuenta.sql` | "Mi cuenta" del alumno: tablas `clientes_foto` (foto y miniatura JPEG en BYTEA) y `marcas` (marcas declaradas). Solo agrega. |

Compatibles con PostgreSQL 9.6 o superior (sin identity columns ni sintaxis exclusiva de versiones recientes).

## Aplicar en local con el script
`npm run migrate:local` (desde `web/backend`, usa `.env.dev`). Aplica en orden las migraciones que falten y las registra en la tabla `schema_migrations` (nombre, aplicado_en), cada una en su transaccion. Aborta si el host de `DATABASE_URL` no es local.

## Produccion (Railway)
`migrate.js` no se usa en produccion. Copiar el contenido de cada `.sql` pendiente y ejecutarlo a mano en el orden numerico. Cada archivo es autosuficiente e idempotente.
