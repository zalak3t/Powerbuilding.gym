-- ============================================================
--  Powerbuilding.gym — Schema de base de datos
--  Orden: usuarios → clientes → bloques → reservas → asistencias
-- ============================================================

-- ── usuarios ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS usuarios (
  id             SERIAL        PRIMARY KEY,
  nombre         VARCHAR(100)  NOT NULL,
  email          VARCHAR(150)  NOT NULL,
  telefono       VARCHAR(20),
  password_hash  VARCHAR(255)  NOT NULL,
  rol            VARCHAR(20)   NOT NULL DEFAULT 'alumno',
  activo         BOOLEAN       NOT NULL DEFAULT TRUE,
  creado_en      TIMESTAMP     NOT NULL DEFAULT NOW(),
  actualizado_en TIMESTAMP     NOT NULL DEFAULT NOW(),

  CONSTRAINT usuarios_email_unique UNIQUE (email),
  CONSTRAINT usuarios_rol_check    CHECK  (rol IN ('admin', 'alumno'))
);

-- ── clientes ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS clientes (
  id             SERIAL        PRIMARY KEY,
  usuario_id     INTEGER       REFERENCES usuarios(id) ON DELETE SET NULL,
  nombre         VARCHAR(100)  NOT NULL,
  email          VARCHAR(150)  NOT NULL,
  telefono       VARCHAR(20),
  notas          TEXT,
  estado         VARCHAR(20)   NOT NULL DEFAULT 'activo',
  fecha_ingreso  DATE          NOT NULL DEFAULT CURRENT_DATE,
  ultima_visita  DATE,
  creado_en      TIMESTAMP     NOT NULL DEFAULT NOW(),
  actualizado_en TIMESTAMP     NOT NULL DEFAULT NOW(),

  CONSTRAINT clientes_email_unique  UNIQUE (email),
  CONSTRAINT clientes_estado_check  CHECK  (estado IN ('activo', 'bloqueado', 'suspendido'))
);

-- ── bloques ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bloques (
  id             SERIAL        PRIMARY KEY,
  dia            VARCHAR(20)   NOT NULL,
  horario        VARCHAR(30)   NOT NULL,
  capacidad      INTEGER       NOT NULL DEFAULT 12,
  estado         VARCHAR(20)   NOT NULL DEFAULT 'activo',
  mensaje        TEXT,
  creado_en      TIMESTAMP     NOT NULL DEFAULT NOW(),
  actualizado_en TIMESTAMP     NOT NULL DEFAULT NOW(),

  CONSTRAINT bloques_dia_check         CHECK (dia IN ('Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo')),
  CONSTRAINT bloques_estado_check      CHECK (estado IN ('activo', 'suspendido')),
  CONSTRAINT bloques_capacidad_pos     CHECK (capacidad > 0),
  CONSTRAINT unique_bloque_dia_horario UNIQUE (dia, horario)
);

-- ── reservas ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reservas (
  id          SERIAL     PRIMARY KEY,
  cliente_id  INTEGER    NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  bloque_id   INTEGER    NOT NULL REFERENCES bloques(id)  ON DELETE CASCADE,
  creado_en   TIMESTAMP  NOT NULL DEFAULT NOW(),

  -- Un cliente no puede reservar el mismo bloque dos veces
  CONSTRAINT reservas_unique UNIQUE (cliente_id, bloque_id)
);

-- ── asistencias ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS asistencias (
  id          SERIAL   PRIMARY KEY,
  reserva_id  INTEGER  NOT NULL REFERENCES reservas(id) ON DELETE CASCADE,
  fecha       DATE     NOT NULL DEFAULT CURRENT_DATE,
  creado_en   TIMESTAMP NOT NULL DEFAULT NOW(),

  -- No se puede marcar dos veces la misma asistencia en el mismo día
  CONSTRAINT asistencias_unique UNIQUE (reserva_id, fecha)
);

-- ── Índices ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_usuarios_email       ON usuarios    (email);
CREATE INDEX IF NOT EXISTS idx_clientes_email       ON clientes    (email);
CREATE INDEX IF NOT EXISTS idx_clientes_estado      ON clientes    (estado);
CREATE INDEX IF NOT EXISTS idx_bloques_dia          ON bloques     (dia);
CREATE INDEX IF NOT EXISTS idx_bloques_estado       ON bloques     (estado);
CREATE INDEX IF NOT EXISTS idx_reservas_cliente_id  ON reservas    (cliente_id);
CREATE INDEX IF NOT EXISTS idx_reservas_bloque_id   ON reservas    (bloque_id);
CREATE INDEX IF NOT EXISTS idx_asistencias_reserva  ON asistencias (reserva_id);
CREATE INDEX IF NOT EXISTS idx_asistencias_fecha    ON asistencias (fecha);
