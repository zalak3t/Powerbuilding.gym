const { ejecutarRevision } = require('../services/notificaciones.service');

const INTERVALO_MS = 10 * 60 * 1000;
let timer = null;
let corriendo = false; // candado: evita ejecuciones solapadas

async function tick() {
  if (corriendo) return;
  corriendo = true;
  try {
    const r = await ejecutarRevision();
    if (r.recordatorios || r.vencimientos) {
      console.log('[notificaciones] revisión: ' + r.recordatorios + ' recordatorio(s), ' + r.vencimientos + ' vencimiento(s)');
    }
  } catch (e) {
    console.error('[notificaciones] revisión falló:', e && e.message);
  } finally {
    corriendo = false;
  }
}

// Inicia el job cada 10 min salvo NOTIF_JOBS=off. Devuelve true si quedó activo.
function start() {
  if (String(process.env.NOTIF_JOBS || '').toLowerCase() === 'off') {
    console.log('[notificaciones] jobs desactivados (NOTIF_JOBS=off)');
    return false;
  }
  if (timer) return true;
  timer = setInterval(tick, INTERVALO_MS);
  timer.unref();
  return true;
}

function activo() {
  return timer !== null;
}

module.exports = { start, activo, tick };
