const { query } = require('../config/db');
const { withTransaction } = require('../utils/tx');
const { DIAS } = require('../utils/validate');
const { hoyChile, HOY_CL_SQL } = require('../utils/fechas');
const { getClienteById } = require('./clientes.service');
const { hashPassword, verifyPassword } = require('./auth.service');
const { miniaturaDataUri } = require('./fotos.service');

// Perfil + membresía del cliente (el cliente ya viene resuelto desde el JWT).
async function getPerfil(clienteId) {
  const c = await getClienteById(clienteId);
  if (!c) return null;
  const plan = await query(
    `SELECT pl.nombre FROM pagos p JOIN planes pl ON pl.id = p.plan_id
     WHERE p.cliente_id = $1 AND p.estado = 'pagado'
     ORDER BY p.periodo_hasta DESC, p.id DESC LIMIT 1`,
    [clienteId]
  );
  return {
    nombre: c.nombre,
    email: c.email,
    telefono: c.telefono,
    estado: c.estado,
    miniatura: await miniaturaDataUri(clienteId),
    membresia: {
      estado: c.estado_membresia,
      vence_el: c.vence_el,
      plan: plan.rows[0] ? plan.rows[0].nombre : null,
    },
  };
}

// Actualiza nombre y teléfono en usuarios y clientes (el email no se edita: es el login).
async function updatePerfil(userId, clienteId, { nombre, telefono }) {
  await withTransaction(async (client) => {
    await client.query('UPDATE usuarios SET nombre = $1, telefono = $2, actualizado_en = NOW() WHERE id = $3', [nombre, telefono, userId]);
    await client.query('UPDATE clientes SET nombre = $1, telefono = $2, actualizado_en = NOW() WHERE id = $3', [nombre, telefono, clienteId]);
  });
}

// ── Cambio de contraseña con limitador de fallos en memoria (5 fallos / 15 min por usuario) ──
const MAX_FALLOS = 5;
const VENTANA_MS = 15 * 60 * 1000;
const fallos = new Map(); // userId -> { n, desde }

function bloqueado(userId) {
  const f = fallos.get(userId);
  if (!f) return false;
  if (Date.now() - f.desde > VENTANA_MS) { fallos.delete(userId); return false; }
  return f.n >= MAX_FALLOS;
}
function registrarFallo(userId) {
  const f = fallos.get(userId);
  if (!f || Date.now() - f.desde > VENTANA_MS) fallos.set(userId, { n: 1, desde: Date.now() });
  else f.n++;
}

// Devuelve 'OK' | 'BLOQUEADO' | 'ACTUAL_INCORRECTA' | 'IGUAL' | 'NO_USER'.
async function cambiarPassword(userId, actual, nueva) {
  if (bloqueado(userId)) return 'BLOQUEADO';
  const r = await query('SELECT password_hash FROM usuarios WHERE id = $1', [userId]);
  if (!r.rows[0]) return 'NO_USER';
  const valida = await verifyPassword(actual, r.rows[0].password_hash);
  if (!valida) { registrarFallo(userId); return 'ACTUAL_INCORRECTA'; }
  if (actual === nueva) return 'IGUAL';
  const hash = await hashPassword(nueva);
  await query('UPDATE usuarios SET password_hash = $1, actualizado_en = NOW() WHERE id = $2', [hash, userId]);
  fallos.delete(userId);
  return 'OK';
}

// Historial de pagos propios; el comprobante se descarga con /pagos-online/:transaccion_id/documento.
async function listarPagos(clienteId) {
  const r = await query(
    `SELECT pg.id, pl.nombre AS plan_nombre, pg.monto, pg.metodo, pg.origen, pg.estado,
            to_char(pg.fecha_pago, 'YYYY-MM-DD')    AS fecha_pago,
            to_char(pg.periodo_desde, 'YYYY-MM-DD') AS periodo_desde,
            to_char(pg.periodo_hasta, 'YYYY-MM-DD') AS periodo_hasta,
            tp.id AS transaccion_id,
            COALESCE(d.estado = 'emitido' AND d.pdf IS NOT NULL, FALSE) AS documento_disponible
     FROM pagos pg
     JOIN planes pl ON pl.id = pg.plan_id
     LEFT JOIN transacciones_pago tp ON tp.pago_id = pg.id
     LEFT JOIN documentos_pago d ON d.pago_id = pg.id AND d.tipo = 'comprobante'
     WHERE pg.cliente_id = $1
     ORDER BY pg.fecha_pago DESC, pg.id DESC
     LIMIT 200`,
    [clienteId]
  );
  return r.rows;
}

// Las reservas son recurrentes por bloque semanal (no tienen fecha): se calcula la próxima ocurrencia.
function proximaFecha(dia, hoy) {
  const idx = DIAS.indexOf(dia);
  if (idx < 0) return null;
  const base = new Date(hoy + 'T00:00:00Z');
  const hoyIdx = (base.getUTCDay() + 6) % 7; // Lunes = 0
  base.setUTCDate(base.getUTCDate() + ((idx - hoyIdx + 7) % 7));
  return base.toISOString().slice(0, 10);
}

async function listarReservas(clienteId) {
  const r = await query(
    `SELECT r.id AS reserva_id, b.id AS bloque_id, b.dia, b.horario, b.estado,
            d.nombre AS disciplina, i.nombre AS instructor
     FROM reservas r
     JOIN bloques b ON b.id = r.bloque_id
     LEFT JOIN disciplinas d ON d.id = b.disciplina_id
     LEFT JOIN instructores i ON i.id = b.instructor_id
     WHERE r.cliente_id = $1`,
    [clienteId]
  );
  const hoy = hoyChile();
  return r.rows
    .map((x) => ({ ...x, proxima_fecha: proximaFecha(x.dia, hoy) }))
    .sort((a, b) => (a.proxima_fecha + a.horario).localeCompare(b.proxima_fecha + b.horario));
}

async function listarAsistencia(clienteId) {
  const lista = await query(
    `SELECT a.id, to_char(a.fecha, 'YYYY-MM-DD') AS fecha, b.dia, b.horario, d.nombre AS disciplina
     FROM asistencias a
     JOIN reservas r ON r.id = a.reserva_id
     JOIN bloques b ON b.id = r.bloque_id
     LEFT JOIN disciplinas d ON d.id = b.disciplina_id
     WHERE r.cliente_id = $1
     ORDER BY a.fecha DESC, a.id DESC
     LIMIT 100`,
    [clienteId]
  );
  const cuentas = await query(
    `SELECT COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE a.fecha >= date_trunc('month', ${HOY_CL_SQL})::date)::int AS mes
     FROM asistencias a JOIN reservas r ON r.id = a.reserva_id
     WHERE r.cliente_id = $1`,
    [clienteId]
  );
  return { asistencias: lista.rows, total: cuentas.rows[0].total, mes: cuentas.rows[0].mes };
}

module.exports = {
  getPerfil, updatePerfil, cambiarPassword, listarPagos, listarReservas, listarAsistencia, proximaFecha,
};
