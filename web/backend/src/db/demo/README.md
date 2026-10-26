# Datos de demostración (Capstone)

Solo para la BD **local**. Esta carpeta no es una migración: `migrate.js` solo lee `src/db/migrations/`.

## Archivos
- `demo.sql`: carga datos ficticios (3 instructores, 3 planes `Demo ...`, 12 clientes `demoNN@demo.powerbuilding.test`, reservas, asistencia de las últimas 3 semanas y pagos en distintos estados). Es idempotente y corre en una transacción. Rellena disciplina/instructor solo en bloques donde están vacíos.
- `demo_limpiar.sql`: borra únicamente lo marcado como demo (pagos `[DEMO]`, clientes demo con sus reservas y asistencias, planes `Demo ...`, instructores demo).

## Orden
1. Tener aplicadas las migraciones 001, 002 y 003 (`npm run migrate:local`).
2. Cargar `demo.sql`.
3. Opcional, después de la presentación: `demo_limpiar.sql`.

## Comandos (PowerShell, desde la raíz del repo)
```powershell
$env:PGCLIENTENCODING = 'UTF8'
& 'C:\Program Files\PostgreSQL\18\bin\psql.exe' -h localhost -U <usuario> -d <base_local> -f web/backend/src/db/demo/demo.sql
& 'C:\Program Files\PostgreSQL\18\bin\psql.exe' -h localhost -U <usuario> -d <base_local> -f web/backend/src/db/demo/demo_limpiar.sql
```
