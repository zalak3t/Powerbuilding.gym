-- ============================================================
--  DATOS DE DEMOSTRACION (Capstone). SOLO PARA BD LOCAL.
--  Todo es ficticio y se identifica asi:
--    clientes / instructores: correo @demo.powerbuilding.test
--    clientes y pagos: notas = '[DEMO]'
--    planes: nombre empieza con 'Demo '
--  Idempotente (se puede ejecutar varias veces), todo en una transaccion.
--  Solo INSERT, salvo un UPDATE que rellena disciplina/instructor
--  en bloques que los tienen en NULL (nunca sobrescribe valores).
--  Se revierte con demo_limpiar.sql
--  Requiere las migraciones 001, 002 y 003 aplicadas.
-- ============================================================
\set ON_ERROR_STOP on

BEGIN;

-- ── instructores (3) ─────────────────────────────────────────
INSERT INTO instructores (nombre, email, telefono, especialidad)
SELECT v.nombre, v.email, v.telefono, v.especialidad
FROM (VALUES
  ('Rodrigo Valdés (demo)',  'demo.inst1@demo.powerbuilding.test', '+56 9 0000 1001', 'Powerlifting'),
  ('Catalina Muñoz (demo)',  'demo.inst2@demo.powerbuilding.test', '+56 9 0000 1002', 'Hipertrofia'),
  ('Andrés Carrasco (demo)', 'demo.inst3@demo.powerbuilding.test', '+56 9 0000 1003', 'Acondicionamiento')
) AS v(nombre, email, telefono, especialidad)
WHERE NOT EXISTS (SELECT 1 FROM instructores i WHERE i.email = v.email);

-- ── bloques: rellena SOLO los NULL (disciplinas existentes de la migracion 001) ──
UPDATE bloques b SET
  disciplina_id = COALESCE(b.disciplina_id, (
    SELECT d.id FROM disciplinas d WHERE lower(d.nombre) = CASE b.dia
      WHEN 'Lunes'     THEN 'powerlifting'
      WHEN 'Jueves'    THEN 'powerlifting'
      WHEN 'Martes'    THEN 'powerbuilding'
      WHEN 'Viernes'   THEN 'powerbuilding'
      ELSE 'acondicionamiento' END)),
  instructor_id = COALESCE(b.instructor_id, (
    SELECT i.id FROM instructores i WHERE i.email = CASE b.dia
      WHEN 'Lunes'     THEN 'demo.inst1@demo.powerbuilding.test'
      WHEN 'Jueves'    THEN 'demo.inst1@demo.powerbuilding.test'
      WHEN 'Martes'    THEN 'demo.inst2@demo.powerbuilding.test'
      WHEN 'Viernes'   THEN 'demo.inst2@demo.powerbuilding.test'
      ELSE 'demo.inst3@demo.powerbuilding.test' END))
WHERE b.disciplina_id IS NULL OR b.instructor_id IS NULL;

-- ── planes (3) ───────────────────────────────────────────────
INSERT INTO planes (nombre, descripcion, beneficios, duracion_dias, precio) VALUES
  ('Demo Mensual',    'Plan mensual de demostración',    'Acceso a bloques reservables durante 30 días', 30, 35000),
  ('Demo Trimestral', 'Plan trimestral de demostración', 'Acceso por 90 días con precio rebajado',      90, 90000),
  ('Demo Pase Libre', 'Plan libre de demostración',      'Acceso libre durante 30 días',                 30, 50000)
ON CONFLICT DO NOTHING;

-- ── clientes demo (12) ───────────────────────────────────────
INSERT INTO clientes (nombre, email, telefono, notas, estado, fecha_ingreso, ultima_visita) VALUES
  ('Camila Torres',     'demo01@demo.powerbuilding.test', '+56 9 0000 0001', '[DEMO]', 'activo',     CURRENT_DATE - 120, CURRENT_DATE - 1),
  ('Matías Vergara',    'demo02@demo.powerbuilding.test', '+56 9 0000 0002', '[DEMO]', 'activo',     CURRENT_DATE - 95,  CURRENT_DATE - 1),
  ('Javiera Soto',      'demo03@demo.powerbuilding.test', '+56 9 0000 0003', '[DEMO]', 'activo',     CURRENT_DATE - 80,  CURRENT_DATE - 2),
  ('Nicolás Araya',     'demo04@demo.powerbuilding.test', '+56 9 0000 0004', '[DEMO]', 'activo',     CURRENT_DATE - 75,  CURRENT_DATE - 1),
  ('Francisca Lagos',   'demo05@demo.powerbuilding.test', '+56 9 0000 0005', '[DEMO]', 'activo',     CURRENT_DATE - 60,  CURRENT_DATE - 3),
  ('Diego Contreras',   'demo06@demo.powerbuilding.test', '+56 9 0000 0006', '[DEMO]', 'activo',     CURRENT_DATE - 55,  CURRENT_DATE - 4),
  ('Valentina Pizarro', 'demo07@demo.powerbuilding.test', '+56 9 0000 0007', '[DEMO]', 'activo',     CURRENT_DATE - 70,  CURRENT_DATE - 2),
  ('Sebastián Rivas',   'demo08@demo.powerbuilding.test', '+56 9 0000 0008', '[DEMO]', 'activo',     CURRENT_DATE - 45,  CURRENT_DATE - 1),
  ('Constanza Mella',   'demo09@demo.powerbuilding.test', '+56 9 0000 0009', '[DEMO]', 'activo',     CURRENT_DATE - 30,  CURRENT_DATE - 3),
  ('Felipe Bravo',      'demo10@demo.powerbuilding.test', '+56 9 0000 0010', '[DEMO]', 'activo',     CURRENT_DATE - 85,  CURRENT_DATE - 2),
  ('Antonia Salinas',   'demo11@demo.powerbuilding.test', '+56 9 0000 0011', '[DEMO]', 'suspendido', CURRENT_DATE - 110, CURRENT_DATE - 40),
  ('Cristóbal Ibáñez',  'demo12@demo.powerbuilding.test', '+56 9 0000 0012', '[DEMO]', 'bloqueado',  CURRENT_DATE - 100, CURRENT_DATE - 60)
ON CONFLICT (email) DO NOTHING;

-- ── reservas: 2 bloques por cliente ──────────────────────────
-- patron = inicio del horario (el bloque se resuelve por dia + horario)
INSERT INTO reservas (cliente_id, bloque_id)
SELECT c.id, b.id
FROM (VALUES
  ('demo01@demo.powerbuilding.test', 'Lunes',     '18:%'), ('demo01@demo.powerbuilding.test', 'Miércoles', '18:%'),
  ('demo02@demo.powerbuilding.test', 'Lunes',     '18:%'), ('demo02@demo.powerbuilding.test', 'Miércoles', '18:%'),
  ('demo03@demo.powerbuilding.test', 'Lunes',     '18:%'), ('demo03@demo.powerbuilding.test', 'Miércoles', '18:%'),
  ('demo04@demo.powerbuilding.test', 'Lunes',     '18:%'), ('demo04@demo.powerbuilding.test', 'Miércoles', '18:%'),
  ('demo05@demo.powerbuilding.test', 'Martes',    '9:%'),  ('demo05@demo.powerbuilding.test', 'Jueves',    '9:%'),
  ('demo06@demo.powerbuilding.test', 'Martes',    '9:%'),  ('demo06@demo.powerbuilding.test', 'Jueves',    '9:%'),
  ('demo07@demo.powerbuilding.test', 'Martes',    '9:%'),  ('demo07@demo.powerbuilding.test', 'Jueves',    '9:%'),
  ('demo08@demo.powerbuilding.test', 'Martes',    '9:%'),  ('demo08@demo.powerbuilding.test', 'Jueves',    '9:%'),
  ('demo09@demo.powerbuilding.test', 'Viernes',   '18:%'), ('demo09@demo.powerbuilding.test', 'Sábado',    '10:%'),
  ('demo10@demo.powerbuilding.test', 'Viernes',   '18:%'), ('demo10@demo.powerbuilding.test', 'Sábado',    '10:%'),
  ('demo11@demo.powerbuilding.test', 'Lunes',     '9:%'),  ('demo11@demo.powerbuilding.test', 'Viernes',   '9:%'),
  ('demo12@demo.powerbuilding.test', 'Lunes',     '9:%'),  ('demo12@demo.powerbuilding.test', 'Viernes',   '9:%')
) AS v(email, dia, patron)
JOIN clientes c ON c.email = v.email
JOIN bloques  b ON b.dia = v.dia AND b.horario LIKE v.patron
ON CONFLICT (cliente_id, bloque_id) DO NOTHING;

-- ── asistencias: ultimas 3 semanas, en el dia de la semana del bloque ──
-- Solo clientes demo activos, desde su fecha de ingreso; ~75 % de asistencia (determinista).
INSERT INTO asistencias (reserva_id, fecha)
SELECT r.id, (CURRENT_DATE - g.n)
FROM reservas r
JOIN clientes c ON c.id = r.cliente_id
JOIN bloques  b ON b.id = r.bloque_id
CROSS JOIN generate_series(1, 21) AS g(n)
WHERE c.notas = '[DEMO]'
  AND c.email LIKE '%@demo.powerbuilding.test'
  AND c.estado = 'activo'
  AND (CURRENT_DATE - g.n) >= c.fecha_ingreso
  AND extract(isodow FROM (CURRENT_DATE - g.n)) = CASE b.dia
        WHEN 'Lunes' THEN 1 WHEN 'Martes' THEN 2 WHEN 'Miércoles' THEN 3
        WHEN 'Jueves' THEN 4 WHEN 'Viernes' THEN 5 WHEN 'Sábado' THEN 6
        WHEN 'Domingo' THEN 7 END
  AND (r.cliente_id + extract(doy FROM (CURRENT_DATE - g.n))::int) % 4 <> 0
ON CONFLICT (reserva_id, fecha) DO NOTHING;

-- ── pagos: vigentes, por vencer, vencidos, anulado y un cliente sin pago ──
-- periodo_desde = fecha_pago; periodo_hasta = desde + duracion_dias - 1; monto = precio del plan
INSERT INTO pagos (cliente_id, plan_id, monto, fecha_pago, metodo, periodo_desde, periodo_hasta, estado, notas)
SELECT c.id, p.id, p.precio, (CURRENT_DATE - v.hace), v.metodo,
       (CURRENT_DATE - v.hace), (CURRENT_DATE - v.hace + p.duracion_dias - 1), v.estado, '[DEMO]'
FROM (VALUES
  ('demo01@demo.powerbuilding.test', 'Demo Mensual',    10, 'transferencia', 'pagado'),   -- vigente
  ('demo02@demo.powerbuilding.test', 'Demo Mensual',    27, 'efectivo',      'pagado'),   -- vence en 2 dias
  ('demo03@demo.powerbuilding.test', 'Demo Mensual',    28, 'transferencia', 'pagado'),   -- vence manana
  ('demo04@demo.powerbuilding.test', 'Demo Trimestral', 30, 'transferencia', 'pagado'),   -- vigente
  ('demo05@demo.powerbuilding.test', 'Demo Pase Libre', 15, 'efectivo',      'pagado'),   -- vigente
  ('demo06@demo.powerbuilding.test', 'Demo Mensual',    50, 'efectivo',      'pagado'),   -- vencido
  ('demo07@demo.powerbuilding.test', 'Demo Mensual',    61, 'efectivo',      'pagado'),   -- historial
  ('demo07@demo.powerbuilding.test', 'Demo Mensual',    31, 'transferencia', 'pagado'),   -- vencido hace 2 dias
  ('demo08@demo.powerbuilding.test', 'Demo Pase Libre',  5, 'otro',          'anulado'),  -- anulado
  ('demo08@demo.powerbuilding.test', 'Demo Pase Libre',  4, 'transferencia', 'pagado'),   -- vigente
  ('demo09@demo.powerbuilding.test', 'Demo Mensual',    20, 'otro',          'pagado'),   -- vigente
  ('demo10@demo.powerbuilding.test', 'Demo Trimestral', 80, 'transferencia', 'pagado'),   -- vence en 9 dias
  ('demo11@demo.powerbuilding.test', 'Demo Mensual',    45, 'efectivo',      'pagado')    -- vencido (suspendido)
) AS v(email, plan, hace, metodo, estado)
JOIN clientes c ON c.email = v.email
JOIN planes   p ON lower(p.nombre) = lower(v.plan)
WHERE NOT EXISTS (
  SELECT 1 FROM pagos x
  WHERE x.cliente_id = c.id AND x.plan_id = p.id
    AND x.fecha_pago = (CURRENT_DATE - v.hace) AND x.notas = '[DEMO]'
);

COMMIT;
