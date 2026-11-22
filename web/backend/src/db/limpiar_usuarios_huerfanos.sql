-- ============================================================
--  Limpieza unica de cuentas de acceso huerfanas
--
--  Una cuenta huerfana es un `usuarios` de rol 'alumno' que ya no tiene ficha en
--  `clientes` (quedó así al eliminar clientes antes de la migracion 006). Su correo
--  sigue ocupado y esa persona no puede volver a registrarse.
--
--  USO (a mano, por el responsable del proyecto; haga un respaldo antes):
--    1) Ejecute este archivo tal cual. El PASO 1 solo lee; el PASO 2 corre dentro de una
--       transaccion que termina en ROLLBACK, asi que no cambia nada y muestra que borraria.
--    2) Si el resultado es el esperado, cambie ROLLBACK por COMMIT en el PASO 2 y vuelva a ejecutar.
--
--  Nunca toca cuentas de administrador ni cuentas con ficha.
-- ============================================================

\echo '--- PASO 1: cuentas huerfanas (solo lectura) ---'
SELECT u.id, u.email, u.creado_en
FROM usuarios u
WHERE u.rol = 'alumno'
  AND NOT EXISTS (SELECT 1 FROM clientes c WHERE c.usuario_id = u.id)
ORDER BY u.id;

\echo '--- PASO 2: borrado (termina en ROLLBACK; cambie a COMMIT para aplicar) ---'
BEGIN;

DELETE FROM usuarios u
WHERE u.rol = 'alumno'
  AND NOT EXISTS (SELECT 1 FROM clientes c WHERE c.usuario_id = u.id)
RETURNING u.id, u.email;

ROLLBACK;
-- COMMIT;
