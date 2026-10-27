-- ============================================================
--  Migracion 004: pago en linea (Webpay Plus) y comprobantes (Bloque 7)
--  Solo AGREGA o amplía restricciones (no borra datos).
--  Idempotente y compatible con PostgreSQL 9.6 o superior.
--  Se puede copiar y ejecutar sola, tantas veces como se quiera.
-- ============================================================

-- ── pagos: metodo 'webpay' y origen del pago ─────────────────
ALTER TABLE pagos DROP CONSTRAINT IF EXISTS pagos_metodo_valido;
ALTER TABLE pagos ADD CONSTRAINT pagos_metodo_valido
  CHECK (metodo IN ('efectivo', 'transferencia', 'otro', 'webpay'));

ALTER TABLE pagos ADD COLUMN IF NOT EXISTS origen VARCHAR(10) NOT NULL DEFAULT 'manual';
ALTER TABLE pagos DROP CONSTRAINT IF EXISTS pagos_origen_valido;
ALTER TABLE pagos ADD CONSTRAINT pagos_origen_valido CHECK (origen IN ('manual', 'online'));

-- ── transacciones_pago ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS transacciones_pago (
  id             SERIAL        PRIMARY KEY,
  cliente_id     INTEGER       NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  plan_id        INTEGER       NOT NULL REFERENCES planes(id)   ON DELETE RESTRICT,
  monto          INTEGER       NOT NULL,   -- pesos chilenos enteros, siempre el precio del plan
  proveedor      VARCHAR(30)   NOT NULL,
  buy_order      VARCHAR(26)   NOT NULL,
  token          TEXT,
  estado         VARCHAR(20)   NOT NULL DEFAULT 'iniciada',
  respuesta      JSONB,                    -- lista blanca del proveedor; SIN datos de tarjeta
  detalle        TEXT,
  pago_id        INTEGER       REFERENCES pagos(id) ON DELETE SET NULL,
  creado_en      TIMESTAMP     NOT NULL DEFAULT NOW(),
  actualizado_en TIMESTAMP     NOT NULL DEFAULT NOW(),
  finalizado_en  TIMESTAMP,

  CONSTRAINT transacciones_buy_order_unique UNIQUE (buy_order),
  CONSTRAINT transacciones_token_unique     UNIQUE (token),
  CONSTRAINT transacciones_monto_pos        CHECK (monto > 0),
  CONSTRAINT transacciones_estado_valido    CHECK (estado IN ('iniciada','autorizada','rechazada','anulada','expirada'))
);

CREATE INDEX IF NOT EXISTS idx_transacciones_cliente ON transacciones_pago (cliente_id);
CREATE INDEX IF NOT EXISTS idx_transacciones_estado  ON transacciones_pago (estado);

-- ── documentos_pago ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS documentos_pago (
  id         SERIAL        PRIMARY KEY,
  pago_id    INTEGER       NOT NULL REFERENCES pagos(id) ON DELETE CASCADE,
  tipo       VARCHAR(20)   NOT NULL,
  proveedor  VARCHAR(30)   NOT NULL,
  folio      VARCHAR(40),
  estado     VARCHAR(20)   NOT NULL DEFAULT 'pendiente',
  pdf        BYTEA,
  enviado_en TIMESTAMP,
  detalle    TEXT,
  creado_en  TIMESTAMP     NOT NULL DEFAULT NOW(),

  CONSTRAINT documentos_pago_tipo_valido   CHECK (tipo IN ('comprobante', 'boleta')),
  CONSTRAINT documentos_pago_estado_valido CHECK (estado IN ('pendiente', 'emitido', 'error')),
  CONSTRAINT documentos_pago_unique        UNIQUE (pago_id, tipo)
);

-- ── notificaciones: nueva clave 'pago_confirmado' ────────────
ALTER TABLE plantillas_notificacion DROP CONSTRAINT IF EXISTS plantillas_clave_valida;
ALTER TABLE plantillas_notificacion ADD CONSTRAINT plantillas_clave_valida CHECK (clave IN
  ('confirmacion_reserva', 'recordatorio_bloque', 'vencimiento_membresia', 'pago_confirmado'));

ALTER TABLE notificaciones_log DROP CONSTRAINT IF EXISTS notif_log_tipo;
ALTER TABLE notificaciones_log ADD CONSTRAINT notif_log_tipo CHECK (tipo IN
  ('confirmacion_reserva', 'recordatorio_bloque', 'vencimiento_membresia', 'pago_confirmado'));

-- Variables: {{nombre}}, {{plan}}, {{monto}}, {{fecha_vencimiento}}, {{folio}}, {{link_pago}}
INSERT INTO plantillas_notificacion (clave, nombre, asunto, cuerpo) VALUES
  ('pago_confirmado',
   'Pago confirmado',
   'Pago recibido: plan {{plan}}',
   E'Hola {{nombre}},\n\nRecibimos tu pago de {{monto}} por el plan {{plan}} (comprobante {{folio}}).\n\nTu plan está vigente hasta el {{fecha_vencimiento}}.\n\n¡Gracias por entrenar con nosotros!')
ON CONFLICT (clave) DO NOTHING;

-- Agrega {{link_pago}} a la plantilla de vencimiento SOLO si sigue identica a la original de la
-- migracion 002 (no pisa ediciones hechas por el administrador).
UPDATE plantillas_notificacion
SET cuerpo = E'Hola {{nombre}},\n\nTu plan {{plan}} vence el {{fecha_vencimiento}}.\n\nPara renovarlo y seguir entrenando sin interrupciones, paga en línea aquí: {{link_pago}}\nO contáctanos / paga directamente en el gimnasio.\n\n¡Gracias por entrenar con nosotros!',
    actualizado_en = NOW()
WHERE clave = 'vencimiento_membresia'
  AND cuerpo = E'Hola {{nombre}},\n\nTu plan {{plan}} vence el {{fecha_vencimiento}}.\n\nPara renovarlo y seguir entrenando sin interrupciones, contáctanos o paga directamente en el gimnasio.\n\n¡Gracias por entrenar con nosotros!';
