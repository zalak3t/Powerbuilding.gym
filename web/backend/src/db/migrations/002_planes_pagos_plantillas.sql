-- ============================================================
--  Migracion 002: planes, pagos y plantillas de notificacion (Bloque 2b)
--  Solo AGREGA (no borra ni modifica nada existente).
--  Idempotente y compatible con PostgreSQL 9.6 o superior.
--  Se puede copiar y ejecutar sola, tantas veces como se quiera.
--  Sin precios ni planes de ejemplo: los crea el administrador.
-- ============================================================

-- ── planes ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS planes (
  id             SERIAL        PRIMARY KEY,
  nombre         VARCHAR(80)   NOT NULL,
  descripcion    TEXT,
  beneficios     TEXT,
  duracion_dias  INTEGER       NOT NULL,
  precio         INTEGER       NOT NULL,   -- pesos chilenos enteros
  activo         BOOLEAN       NOT NULL DEFAULT TRUE,
  creado_en      TIMESTAMP     NOT NULL DEFAULT NOW(),
  actualizado_en TIMESTAMP     NOT NULL DEFAULT NOW(),

  CONSTRAINT planes_nombre_no_vacio CHECK (length(btrim(nombre)) > 0),
  CONSTRAINT planes_duracion_pos    CHECK (duracion_dias > 0),
  CONSTRAINT planes_precio_no_neg   CHECK (precio >= 0)
);

-- Unicidad sin distinguir mayusculas/minusculas
CREATE UNIQUE INDEX IF NOT EXISTS uq_planes_nombre_lower ON planes (lower(nombre));

-- ── pagos ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pagos (
  id             SERIAL        PRIMARY KEY,
  cliente_id     INTEGER       NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  plan_id        INTEGER       NOT NULL REFERENCES planes(id)   ON DELETE RESTRICT,
  monto          INTEGER       NOT NULL,   -- pesos chilenos enteros
  fecha_pago     DATE          NOT NULL,
  metodo         VARCHAR(20)   NOT NULL,
  periodo_desde  DATE          NOT NULL,
  periodo_hasta  DATE          NOT NULL,   -- inclusivo: desde + duracion_dias - 1
  estado         VARCHAR(20)   NOT NULL DEFAULT 'pagado',
  notas          TEXT,
  creado_en      TIMESTAMP     NOT NULL DEFAULT NOW(),
  actualizado_en TIMESTAMP     NOT NULL DEFAULT NOW(),

  CONSTRAINT pagos_monto_no_neg CHECK (monto >= 0),
  CONSTRAINT pagos_metodo_valido CHECK (metodo IN ('efectivo', 'transferencia', 'otro')),
  CONSTRAINT pagos_estado_valido CHECK (estado IN ('pagado', 'anulado')),
  CONSTRAINT pagos_periodo_valido CHECK (periodo_hasta >= periodo_desde)
);

CREATE INDEX IF NOT EXISTS idx_pagos_cliente_id  ON pagos (cliente_id);
CREATE INDEX IF NOT EXISTS idx_pagos_fecha_pago  ON pagos (fecha_pago);
CREATE INDEX IF NOT EXISTS idx_pagos_membresia   ON pagos (cliente_id, estado, periodo_hasta);

-- ── plantillas_notificacion ──────────────────────────────────
CREATE TABLE IF NOT EXISTS plantillas_notificacion (
  id             SERIAL        PRIMARY KEY,
  clave          VARCHAR(50)   NOT NULL,
  nombre         VARCHAR(100)  NOT NULL,
  asunto         VARCHAR(150)  NOT NULL,
  cuerpo         TEXT          NOT NULL,
  activo         BOOLEAN       NOT NULL DEFAULT TRUE,
  creado_en      TIMESTAMP     NOT NULL DEFAULT NOW(),
  actualizado_en TIMESTAMP     NOT NULL DEFAULT NOW(),

  CONSTRAINT plantillas_clave_unique UNIQUE (clave),
  CONSTRAINT plantillas_clave_valida CHECK (clave IN
    ('confirmacion_reserva', 'recordatorio_bloque', 'vencimiento_membresia'))
);

-- Variables disponibles: {{nombre}}, {{dia}}, {{horario}}, {{plan}}, {{fecha_vencimiento}}
INSERT INTO plantillas_notificacion (clave, nombre, asunto, cuerpo) VALUES
  ('confirmacion_reserva',
   'Confirmación de reserva',
   'Reserva confirmada: {{dia}} {{horario}}',
   E'Hola {{nombre}},\n\nTu reserva quedó confirmada para el bloque del {{dia}} a las {{horario}}.\n\nSi no puedes asistir, cancélala con anticipación para liberar el cupo.\n\n¡Nos vemos en Powerbuilding.gym!'),
  ('recordatorio_bloque',
   'Recordatorio de bloque',
   'Recordatorio: tu bloque de {{dia}} a las {{horario}}',
   E'Hola {{nombre}},\n\nTe recordamos que tienes un bloque reservado el {{dia}} a las {{horario}}.\n\n¡Te esperamos para entrenar!'),
  ('vencimiento_membresia',
   'Vencimiento de membresía',
   'Tu plan {{plan}} vence el {{fecha_vencimiento}}',
   E'Hola {{nombre}},\n\nTu plan {{plan}} vence el {{fecha_vencimiento}}.\n\nPara renovarlo y seguir entrenando sin interrupciones, contáctanos o paga directamente en el gimnasio.\n\n¡Gracias por entrenar con nosotros!')
ON CONFLICT (clave) DO NOTHING;
