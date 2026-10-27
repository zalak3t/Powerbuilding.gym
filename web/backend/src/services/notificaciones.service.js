const { getPlantillaByClave } = require('./plantillas.service');
const { enviarCorreo } = require('./email.service');
const { reemplazarVariables } = require('../utils/plantillas');
const { query } = require('../config/db');
const v = require('../utils/validate');
const { TZ, HOY_CL_SQL } = require('../utils/fechas');
const { frontendUrl } = require('../config/pagos');

/**
 * Arma el correo desde la plantilla de la BD (clave = tipo) y lo envía/registra.
 * Plantilla inactiva o inexistente: no se envía; se registra como 'error' con el motivo.
 * `cliente` = { id, nombre, email }. Devuelve { estado, duplicado }.
 */
async function enviarPlantilla({ clave, cliente, datos, claveUnica, adjuntos }) {
  const plantilla = await getPlantillaByClave(clave);
  const vars = Object.assign({ nombre: cliente.nombre }, datos);
  const base = { tipo: clave, clienteId: cliente.id, destinatario: cliente.email, claveUnica };

  if (!plantilla || !plantilla.activo) {
    const motivo = plantilla ? 'Plantilla inactiva: no se envió' : 'Plantilla inexistente: no se envió';
    return enviarCorreo(Object.assign({}, base, { asunto: clave, texto: '', forzarError: motivo }));
  }
  return enviarCorreo(Object.assign({}, base, {
    asunto: reemplazarVariables(plantilla.asunto, vars),
    texto: reemplazarVariables(plantilla.cuerpo, vars),
    adjuntos,
  }));
}

// R.18: confirmación de reserva. Pensada para llamarse sin await; no lanza nunca.
async function notificarReserva(reservaId) {
  try {
    const r = await query(
      `SELECT r.id AS reserva_id, c.id AS cliente_id, c.nombre, c.email, b.dia, b.horario
       FROM reservas r
       JOIN clientes c ON c.id = r.cliente_id
       JOIN bloques b ON b.id = r.bloque_id
       WHERE r.id = $1`,
      [reservaId]
    );
    const f = r.rows[0];
    if (!f || !v.isEmail(f.email)) return null;
    return await enviarPlantilla({
      clave: 'confirmacion_reserva',
      cliente: { id: f.cliente_id, nombre: f.nombre, email: f.email },
      datos: { dia: f.dia, horario: f.horario },
      claveUnica: 'confirmacion:' + f.reserva_id,
    });
  } catch (e) {
    console.error('[notificaciones] confirmación de reserva falló:', e && e.message);
    return null;
  }
}

// ── Revisión periódica (R.19 y R.20) ────────────────────────────────────────

const DIAS_PREFIJO = ['l', 'ma', 'mi', 'j', 'v', 's', 'd']; // lunes..domingo
const DIA_IDX = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };

// Fecha/hora actual en Santiago: { fecha:'YYYY-MM-DD', minutos, diaIdx (0=lunes) }.
function ahoraChile() {
  const p = {};
  new Intl.DateTimeFormat('en-US', {
    timeZone: TZ, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', weekday: 'short',
  }).formatToParts(new Date()).forEach((x) => { p[x.type] = x.value; });
  return {
    fecha: p.year + '-' + p.month + '-' + p.day,
    minutos: parseInt(p.hour, 10) * 60 + parseInt(p.minute, 10),
    diaIdx: DIA_IDX[p.weekday],
  };
}

// Compara por prefijo en minúsculas: tolera tildes mal codificadas en bloques.dia (ej. "Miércoles").
function esDia(diaTexto, diaIdx) {
  const t = String(diaTexto || '').trim().toLowerCase();
  return t.startsWith(DIAS_PREFIJO[diaIdx]);
}

// Minutos desde medianoche de la hora de inicio en textos como "9:00–12:00" o "07:00 - 08:30"; null si no se puede.
function parseInicio(horario) {
  const m = /(\d{1,2})\s*[:.hH]\s*(\d{2})/.exec(String(horario || ''));
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const mi = parseInt(m[2], 10);
  return h <= 23 && mi <= 59 ? h * 60 + mi : null;
}

function horasRecordatorio(ventanaHoras) {
  if (ventanaHoras !== undefined && ventanaHoras !== null) return ventanaHoras;
  const n = Number(process.env.REMINDER_HOURS);
  return Number.isFinite(n) && n > 0 && n <= 24 ? n : 2;
}

// R.19: recordatorio de bloques de hoy que empiezan dentro de la ventana. Devuelve cuántos generó.
async function revisarRecordatorios(ventanaHoras) {
  const ahora = ahoraChile();
  const limite = ahora.minutos + horasRecordatorio(ventanaHoras) * 60;
  const r = await query(
    `SELECT r.id AS reserva_id, c.id AS cliente_id, c.nombre, c.email, b.dia, b.horario
     FROM reservas r
     JOIN clientes c ON c.id = r.cliente_id
     JOIN bloques b ON b.id = r.bloque_id
     WHERE c.estado = 'activo' AND b.estado = 'activo'`
  );
  let generados = 0;
  for (const f of r.rows) {
    if (!esDia(f.dia, ahora.diaIdx) || !v.isEmail(f.email)) continue;
    const inicio = parseInicio(f.horario);
    if (inicio === null) {
      console.warn('[notificaciones] horario no interpretable, se omite (bloque reserva ' + f.reserva_id + ')');
      continue;
    }
    if (inicio <= ahora.minutos || inicio > limite) continue;
    const res = await enviarPlantilla({
      clave: 'recordatorio_bloque',
      cliente: { id: f.cliente_id, nombre: f.nombre, email: f.email },
      datos: { dia: f.dia, horario: f.horario },
      claveUnica: 'recordatorio:' + f.reserva_id + ':' + ahora.fecha,
    });
    if (!res.duplicado) generados++;
  }
  return generados;
}

// R.20: clientes por_vencer (misma regla que 2b: vence hoy o en ≤7 días, según fecha de Chile).
async function revisarVencimientos() {
  const r = await query(
    `SELECT c.id AS cliente_id, c.nombre, c.email, to_char(m.vence, 'YYYY-MM-DD') AS vence,
            (SELECT pl.nombre FROM pagos p JOIN planes pl ON pl.id = p.plan_id
             WHERE p.cliente_id = c.id AND p.estado = 'pagado'
             ORDER BY p.periodo_hasta DESC, p.id DESC LIMIT 1) AS plan
     FROM clientes c
     JOIN LATERAL (SELECT MAX(p.periodo_hasta) AS vence FROM pagos p
                   WHERE p.cliente_id = c.id AND p.estado = 'pagado') m ON m.vence IS NOT NULL
     WHERE c.estado = 'activo'
       AND m.vence >= ${HOY_CL_SQL} AND m.vence - ${HOY_CL_SQL} <= 7`
  );
  let generados = 0;
  for (const f of r.rows) {
    if (!v.isEmail(f.email)) continue;
    const res = await enviarPlantilla({
      clave: 'vencimiento_membresia',
      cliente: { id: f.cliente_id, nombre: f.nombre, email: f.email },
      datos: { plan: f.plan, fecha_vencimiento: f.vence, link_pago: frontendUrl() + '/?pagar=1' },
      claveUnica: 'vencimiento:' + f.cliente_id + ':' + f.vence,
    });
    if (!res.duplicado) generados++;
  }
  return generados;
}

async function ejecutarRevision({ ventanaHoras } = {}) {
  const recordatorios = await revisarRecordatorios(ventanaHoras);
  const vencimientos = await revisarVencimientos();
  return { recordatorios, vencimientos };
}

// Registro para el panel: más recientes primero, filtros opcionales.
async function listarNotificaciones({ tipo, estado, limit }) {
  const r = await query(
    `SELECT id, tipo, cliente_id, destinatario, asunto, estado, detalle, creado_en
     FROM notificaciones_log
     WHERE ($1::text IS NULL OR tipo = $1) AND ($2::text IS NULL OR estado = $2)
     ORDER BY creado_en DESC, id DESC
     LIMIT $3`,
    [tipo || null, estado || null, limit]
  );
  return r.rows;
}

module.exports = {
  enviarPlantilla, notificarReserva, ejecutarRevision, listarNotificaciones, parseInicio, esDia,
};
