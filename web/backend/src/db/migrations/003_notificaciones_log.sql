-- ============================================================
--  Migracion 003: registro de notificaciones por correo (Bloque 5)
--  Solo AGREGA (no borra ni modifica nada existente).
--  Idempotente y compatible con PostgreSQL 9.6 o superior.
--  Se puede copiar y ejecutar sola, tantas veces como se quiera.
-- ============================================================

CREATE TABLE IF NOT EXISTS notificaciones_log (
  id           SERIAL        PRIMARY KEY,
  tipo         VARCHAR(30)   NOT NULL,
  cliente_id   INTEGER       REFERENCES clientes(id) ON DELETE SET NULL,
  destinatario VARCHAR(150)  NOT NULL,
  asunto       VARCHAR(200)  NOT NULL,
  estado       VARCHAR(20)   NOT NULL,
  detalle      TEXT,
  clave_unica  TEXT          UNIQUE,   -- evita duplicados; NULL = sin control
  creado_en    TIMESTAMP     NOT NULL DEFAULT NOW(),

  CONSTRAINT notif_log_tipo   CHECK (tipo IN ('confirmacion_reserva','recordatorio_bloque','vencimiento_membresia')),
  CONSTRAINT notif_log_estado CHECK (estado IN ('enviado','simulado','error'))
);

CREATE INDEX IF NOT EXISTS idx_notif_log_tipo  ON notificaciones_log (tipo);
CREATE INDEX IF NOT EXISTS idx_notif_log_fecha ON notificaciones_log (creado_en DESC);
