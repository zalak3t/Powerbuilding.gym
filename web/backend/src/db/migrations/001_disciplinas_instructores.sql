-- ============================================================
--  Migracion 001: disciplinas e instructores (Bloque 2a)
--  Solo AGREGA (no borra ni modifica nada existente).
--  Idempotente y compatible con PostgreSQL 9.6 o superior.
--  Se puede copiar y ejecutar sola, tantas veces como se quiera.
-- ============================================================

-- ── disciplinas ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS disciplinas (
  id             SERIAL        PRIMARY KEY,
  nombre         VARCHAR(60)   NOT NULL,
  descripcion    VARCHAR(300),
  activo         BOOLEAN       NOT NULL DEFAULT TRUE,
  creado_en      TIMESTAMP     NOT NULL DEFAULT NOW(),
  actualizado_en TIMESTAMP     NOT NULL DEFAULT NOW(),

  CONSTRAINT disciplinas_nombre_unique    UNIQUE (nombre),
  CONSTRAINT disciplinas_nombre_no_vacio  CHECK  (length(btrim(nombre)) > 0)
);

-- Unicidad sin distinguir mayusculas/minusculas
CREATE UNIQUE INDEX IF NOT EXISTS uq_disciplinas_nombre_lower ON disciplinas (lower(nombre));

INSERT INTO disciplinas (nombre) VALUES
  ('Powerlifting'),
  ('Powerbuilding'),
  ('Acondicionamiento')
ON CONFLICT DO NOTHING;

-- ── instructores ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS instructores (
  id             SERIAL        PRIMARY KEY,
  nombre         VARCHAR(100)  NOT NULL,
  email          VARCHAR(150),
  telefono       VARCHAR(20),
  especialidad   VARCHAR(100),
  activo         BOOLEAN       NOT NULL DEFAULT TRUE,
  creado_en      TIMESTAMP     NOT NULL DEFAULT NOW(),
  actualizado_en TIMESTAMP     NOT NULL DEFAULT NOW(),

  CONSTRAINT instructores_nombre_no_vacio CHECK (length(btrim(nombre)) > 0)
);

-- ── bloques: columnas opcionales (los bloques existentes quedan en NULL) ──
ALTER TABLE bloques ADD COLUMN IF NOT EXISTS disciplina_id INTEGER REFERENCES disciplinas(id)  ON DELETE SET NULL;
ALTER TABLE bloques ADD COLUMN IF NOT EXISTS instructor_id INTEGER REFERENCES instructores(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_bloques_disciplina_id ON bloques (disciplina_id);
CREATE INDEX IF NOT EXISTS idx_bloques_instructor_id ON bloques (instructor_id);
