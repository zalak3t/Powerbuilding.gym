-- ============================================================
--  Powerbuilding.gym — Reset completo de la base de datos
--
--  PELIGRO: elimina TODOS los datos y las tablas.
--  Usar solo en desarrollo para volver a empezar desde cero.
--  NO ejecutar en producción.
--
--  Después de ejecutar esto, volver a correr schema.sql y seed.sql.
-- ============================================================

DROP TABLE IF EXISTS asistencias CASCADE;
DROP TABLE IF EXISTS reservas    CASCADE;
DROP TABLE IF EXISTS bloques     CASCADE;
DROP TABLE IF EXISTS clientes    CASCADE;
DROP TABLE IF EXISTS usuarios    CASCADE;
