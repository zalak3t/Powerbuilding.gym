const { getPlantillaByClave } = require('./plantillas.service');
const { enviarCorreo } = require('./email.service');
const { reemplazarVariables } = require('../utils/plantillas');
const { query } = require('../config/db');
const v = require('../utils/validate');

/**
 * Arma el correo desde la plantilla de la BD (clave = tipo) y lo envía/registra.
 * Plantilla inactiva o inexistente: no se envía; se registra como 'error' con el motivo.
 * `cliente` = { id, nombre, email }. Devuelve { estado, duplicado }.
 */
async function enviarPlantilla({ clave, cliente, datos, claveUnica }) {
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

module.exports = { enviarPlantilla, notificarReserva };
