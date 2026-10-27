-- ============================================================
--  Migracion 005: "Mi cuenta" del alumno (Bloque 8)
--  Foto de perfil (BYTEA, la base es el unico almacenamiento persistente)
--  y marcas declaradas por el alumno (sentadilla, banca, peso muerto).
--  Solo AGREGA tablas e indices (no toca 001-004 ni borra datos).
--  Idempotente y compatible con PostgreSQL 9.6 o superior.
--  Se puede copiar y ejecutar sola, tantas veces como se quiera.
-- ============================================================

-- ── clientes_foto: una foto por cliente (imagen + miniatura) ─
-- Tabla aparte para que los SELECT de clientes no arrastren binarios.
-- Si se borra el cliente, se borra su foto.
CREATE TABLE IF NOT EXISTS clientes_foto (
  cliente_id     INTEGER       PRIMARY KEY REFERENCES clientes(id) ON DELETE CASCADE,
  foto           BYTEA         NOT NULL,
  miniatura      BYTEA         NOT NULL,
  mime           VARCHAR(20)   NOT NULL DEFAULT 'image/jpeg',
  creado_en      TIMESTAMP     NOT NULL DEFAULT NOW(),
  actualizado_en TIMESTAMP     NOT NULL DEFAULT NOW(),

  CONSTRAINT clientes_foto_mime_valido   CHECK (mime = 'image/jpeg'),
  CONSTRAINT clientes_foto_foto_tamano   CHECK (octet_length(foto) BETWEEN 1 AND 65536),
  CONSTRAINT clientes_foto_mini_tamano   CHECK (octet_length(miniatura) BETWEEN 1 AND 8192)
);

-- ── marcas: marcas declaradas por el alumno ──────────────────
CREATE TABLE IF NOT EXISTS marcas (
  id         SERIAL        PRIMARY KEY,
  cliente_id INTEGER       NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  ejercicio  VARCHAR(20)   NOT NULL,
  kg         NUMERIC(5,1)  NOT NULL,
  fecha      DATE          NOT NULL,
  creado_en  TIMESTAMP     NOT NULL DEFAULT NOW(),

  CONSTRAINT marcas_ejercicio_valido CHECK (ejercicio IN ('sentadilla', 'banca', 'peso_muerto')),
  CONSTRAINT marcas_kg_rango         CHECK (kg > 0 AND kg <= 600),
  CONSTRAINT marcas_kg_medio         CHECK (kg * 2 = round(kg * 2))
);

CREATE INDEX IF NOT EXISTS idx_marcas_cliente ON marcas (cliente_id, ejercicio, fecha);
