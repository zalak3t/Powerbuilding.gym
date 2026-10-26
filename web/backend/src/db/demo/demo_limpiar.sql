-- ============================================================
--  Limpieza de los datos de demostracion (revierte demo.sql).
--  Borra SOLO filas marcadas como demo. No toca disciplinas.
--  Al borrar clientes demo se eliminan en cascada sus reservas,
--  asistencias y pagos; los bloques con instructor demo quedan
--  con instructor_id NULL (ON DELETE SET NULL).
--  Nota: la disciplina que demo.sql puso en bloques vacios NO se
--  revierte (no se puede distinguir de una asignada a mano).
-- ============================================================
\set ON_ERROR_STOP on

BEGIN;

DELETE FROM pagos WHERE notas = '[DEMO]';

DELETE FROM clientes
WHERE email LIKE '%@demo.powerbuilding.test' AND notas = '[DEMO]';

DELETE FROM planes
WHERE nombre IN ('Demo Mensual', 'Demo Trimestral', 'Demo Pase Libre');

DELETE FROM instructores
WHERE email LIKE '%@demo.powerbuilding.test';

COMMIT;
