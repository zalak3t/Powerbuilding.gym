-- ============================================================
--  Migracion 006: estado 'eliminado' para clientes
--  Al eliminar un cliente, su ficha se anonimiza y se conserva (con sus pagos,
--  reservas y asistencias) en lugar de borrarse en cascada. Este estado la marca.
--  Solo AMPLIA el CHECK de clientes.estado (no borra ni modifica filas).
--  Idempotente: se puede ejecutar tantas veces como se quiera.
--  Aplicar ANTES de desplegar el codigo que usa el estado 'eliminado'.
-- ============================================================

ALTER TABLE clientes DROP CONSTRAINT IF EXISTS clientes_estado_check;
ALTER TABLE clientes
  ADD CONSTRAINT clientes_estado_check
  CHECK (estado IN ('activo', 'bloqueado', 'suspendido', 'eliminado'));
