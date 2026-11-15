-- ============================================================
--  Migracion 007: metodo 'mercadopago' en pagos
--  Solo AMPLIA el CHECK de pagos.metodo (no borra ni modifica filas).
--  Idempotente: se puede ejecutar tantas veces como se quiera.
--  Aplicar ANTES de desplegar el codigo que registra pagos con Mercado Pago.
-- ============================================================

ALTER TABLE pagos DROP CONSTRAINT IF EXISTS pagos_metodo_valido;
ALTER TABLE pagos ADD CONSTRAINT pagos_metodo_valido
  CHECK (metodo IN ('efectivo', 'transferencia', 'otro', 'webpay', 'mercadopago'));
