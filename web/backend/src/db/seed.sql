-- ============================================================
--  Powerbuilding.gym — Datos seed de prueba
--
--  password_hash: hashes bcrypt reales (cost=12), generados con generateHashes.js
--  Contraseñas de prueba: admin123, carlos123, ana123, felipe123, maria123, diego123
--
--  Ejecutar DESPUÉS de schema.sql.
--  Es idempotente: ON CONFLICT DO NOTHING en las filas con UNIQUE.
-- ============================================================

-- ── 1. usuarios ──────────────────────────────────────────────
-- Hashes bcrypt (cost=12). Contraseñas de prueba: admin123, carlos123, ana123, felipe123, maria123, diego123
INSERT INTO usuarios (nombre, email, telefono, password_hash, rol)
VALUES
  ('Admin Powerbuilding', 'admin@powerbuilding.gym', '+56986105896', '$2b$12$PpHL681WrKksCevQnr2Gke8az8.FqSFtWP7TyxrKjzGLYL/gOk7BW', 'admin'),
  ('Carlos Muñoz',        'carlos@gmail.com',        '+56912345678', '$2b$12$mxjGjIVboZXeJlUIbkyUUuf/Ef9TL63SLzzfV2.hcWnRxCObw1dgW', 'alumno'),
  ('Ana Rojas',           'ana@gmail.com',            '+56923456789', '$2b$12$w9YR2DVasJkCcJJNYYazKuGjqG78mNTI4tIn5h7E5FgdzP72YC1Aa', 'alumno'),
  ('Felipe Soto',         'felipe@gmail.com',         '+56934567890', '$2b$12$dDzW8thCMT7fQQBfgj/1HeU/L31q7fXMyeBpBgF4hDdNJke05sf.e', 'alumno'),
  ('María González',      'maria@gmail.com',          '+56945678901', '$2b$12$8Uz5TYGwYSPuzKK4nWxvieZxicX57DpHBgAwGSLJdvj.GzB02P6K6', 'alumno'),
  ('Diego Pérez',         'diego@gmail.com',          '+56956789012', '$2b$12$xN6RxlsS4VdTo/HHnMslHucvpenrXPF7KCpvJRVUUrvpbyYxKmAtq', 'alumno')
ON CONFLICT (email) DO NOTHING;

-- ── 2. clientes ──────────────────────────────────────────────
-- usuario_id resuelto por subquery para que el seed sea portable
INSERT INTO clientes (usuario_id, nombre, email, telefono, notas, estado, fecha_ingreso, ultima_visita)
VALUES
  (
    (SELECT id FROM usuarios WHERE email = 'carlos@gmail.com'),
    'Carlos Muñoz', 'carlos@gmail.com', '+56912345678',
    'Interesado en competencia. Prefiere bloques de mañana.',
    'activo', '2026-01-10', '2026-05-14'
  ),
  (
    (SELECT id FROM usuarios WHERE email = 'ana@gmail.com'),
    'Ana Rojas', 'ana@gmail.com', '+56923456789',
    'Lesión leve en hombro derecho. Avisar al coach.',
    'activo', '2026-02-03', '2026-05-15'
  ),
  (
    (SELECT id FROM usuarios WHERE email = 'felipe@gmail.com'),
    'Felipe Soto', 'felipe@gmail.com', '+56934567890',
    '',
    'activo', '2026-01-20', '2026-05-10'
  ),
  (
    (SELECT id FROM usuarios WHERE email = 'maria@gmail.com'),
    'María González', 'maria@gmail.com', '+56945678901',
    'Principiante. Requiere mayor seguimiento.',
    'activo', '2026-03-01', '2026-04-28'
  ),
  (
    (SELECT id FROM usuarios WHERE email = 'diego@gmail.com'),
    'Diego Pérez', 'diego@gmail.com', '+56956789012',
    '',
    'bloqueado', '2026-02-15', '2026-04-05'
  )
ON CONFLICT (email) DO NOTHING;

-- ── 3. bloques ───────────────────────────────────────────────
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

-- ── 4. reservas ──────────────────────────────────────────────
-- Referenciamos bloques por (dia, horario) para que sea legible y portable
INSERT INTO reservas (cliente_id, bloque_id)
SELECT c.id, b.id
FROM (VALUES
  ('carlos@gmail.com', 'Lunes',     '9:00–12:00'),
  ('carlos@gmail.com', 'Miércoles', '9:00–12:00'),
  ('carlos@gmail.com', 'Viernes',   '9:00–12:00'),
  ('ana@gmail.com',    'Lunes',     '18:00–20:00'),
  ('ana@gmail.com',    'Martes',    '9:00–12:00'),
  ('ana@gmail.com',    'Jueves',    '18:00–20:00'),
  ('felipe@gmail.com', 'Martes',    '18:00–20:00'),
  ('felipe@gmail.com', 'Sábado',    '10:00–12:00'),
  ('maria@gmail.com',  'Lunes',     '9:00–12:00'),
  ('maria@gmail.com',  'Miércoles', '18:00–20:00')
) AS datos(email_cliente, dia_bloque, horario_bloque)
JOIN clientes c ON c.email = datos.email_cliente
JOIN bloques  b ON b.dia   = datos.dia_bloque AND b.horario = datos.horario_bloque
ON CONFLICT (cliente_id, bloque_id) DO NOTHING;

-- ── 5. asistencias ───────────────────────────────────────────
-- Marcar como asistidas algunas reservas (las primeras por cliente)
INSERT INTO asistencias (reserva_id, fecha)
SELECT r.id, CURRENT_DATE
FROM reservas r
JOIN clientes c ON c.id = r.cliente_id
WHERE c.email IN ('carlos@gmail.com', 'ana@gmail.com')
ON CONFLICT (reserva_id, fecha) DO NOTHING;
