-- ============================================================
--  Migracion 008: recuperacion de contrasena
--  Solo AGREGA la tabla password_resets (no modifica ni borra filas existentes).
--  Se guarda UNICAMENTE el hash SHA-256 del token (nunca el token en claro): si alguien
--  obtuviera la base de datos, los enlaces enviados por correo no serian utilizables.
--  Idempotente: se puede ejecutar tantas veces como se quiera.
--  Aplicar ANTES de desplegar el codigo de recuperacion de contrasena.
-- ============================================================

CREATE TABLE IF NOT EXISTS password_resets (
  id          SERIAL       PRIMARY KEY,
  usuario_id  INTEGER      NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  token_hash  CHAR(64)     NOT NULL,
  expira_en   TIMESTAMP    NOT NULL,
  usado_en    TIMESTAMP,
  creado_en   TIMESTAMP    NOT NULL DEFAULT NOW(),
  CONSTRAINT password_resets_token_unico UNIQUE (token_hash)
);

CREATE INDEX IF NOT EXISTS idx_password_resets_usuario ON password_resets (usuario_id, creado_en);
