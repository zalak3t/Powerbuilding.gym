-- ============================================================
--  Powerbuilding.gym — Datos iniciales (seed)
--
--  Carga solo datos de estructura: los bloques horarios base.
--  NO crea usuarios ni contraseñas. El primer administrador se crea con
--  `npm run create-admin` (ver web/DEPLOYMENT.md), leyendo las credenciales
--  desde variables de entorno.
--
--  Ejecutar DESPUÉS de schema.sql.
--  Es idempotente: ON CONFLICT DO NOTHING en las filas con UNIQUE.
-- ============================================================

-- ── bloques ──────────────────────────────────────────────────
INSERT INTO bloques (dia, horario, capacidad, estado, mensaje)
VALUES
  ('Lunes',     '9:00–12:00',   12, 'activo',    ''),
  ('Lunes',     '18:00–20:00',  12, 'activo',    ''),
  ('Martes',    '9:00–12:00',   12, 'activo',    ''),
  ('Martes',    '18:00–20:00',  12, 'activo',    ''),
  ('Miércoles', '9:00–12:00',   12, 'activo',    ''),
  ('Miércoles', '18:00–20:00',  12, 'activo',    ''),
  ('Jueves',    '9:00–12:00',   12, 'activo',    ''),
  ('Jueves',    '18:00–20:00',  12, 'activo',    ''),
  ('Viernes',   '9:00–12:00',   12, 'activo',    ''),
  ('Viernes',   '18:00–20:00',  12, 'activo',    ''),
  ('Sábado',    '10:00–12:00',  10, 'activo',    ''),
  ('Domingo',   '10:00–12:00',   8, 'suspendido', 'Sin clases este domingo')
ON CONFLICT (dia, horario) DO NOTHING;
