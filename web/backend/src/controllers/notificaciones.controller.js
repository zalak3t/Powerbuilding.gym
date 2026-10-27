const { listarNotificaciones, ejecutarRevision } = require('../services/notificaciones.service');
const { proveedorActivo } = require('../services/email.service');
const job = require('../jobs/notificaciones.job');
const v = require('../utils/validate');

const TIPOS = ['confirmacion_reserva', 'recordatorio_bloque', 'vencimiento_membresia', 'pago_confirmado'];
const ESTADOS = ['enviado', 'simulado', 'error'];
const LIMITE_DEFECTO = 50;
const LIMITE_MAX = 200;

async function listar(req, res) {
  const { tipo, estado } = req.query;
  if (tipo !== undefined && tipo !== '' && !v.isOneOf(tipo, TIPOS)) {
    return res.status(400).json({ ok: false, error: 'tipo inválido' });
  }
  if (estado !== undefined && estado !== '' && !v.isOneOf(estado, ESTADOS)) {
    return res.status(400).json({ ok: false, error: 'estado inválido' });
  }
  let limit = LIMITE_DEFECTO;
  if (req.query.limit !== undefined && req.query.limit !== '') {
    limit = v.parsePositiveInt(req.query.limit);
    if (!limit || limit > LIMITE_MAX) {
      return res.status(400).json({ ok: false, error: 'limit debe ser un entero entre 1 y ' + LIMITE_MAX });
    }
  }
  const notificaciones = await listarNotificaciones({ tipo: tipo || null, estado: estado || null, limit });
  res.json({ ok: true, notificaciones });
}

async function ejecutar(req, res) {
  let ventanaHoras;
  const raw = (req.body || {}).ventana_horas;
  if (raw !== undefined && raw !== null && raw !== '') {
    ventanaHoras = v.parsePositiveInt(raw);
    if (!ventanaHoras || ventanaHoras > 24) {
      return res.status(400).json({ ok: false, error: 'ventana_horas debe ser un entero entre 1 y 24' });
    }
  }
  const resultado = await ejecutarRevision({ ventanaHoras });
  res.json({
    ok: true,
    recordatorios: resultado.recordatorios,
    vencimientos: resultado.vencimientos,
    total: resultado.recordatorios + resultado.vencimientos,
  });
}

// Solo informa el modo; nunca devuelve claves ni remitente.
function estado(req, res) {
  res.json({ ok: true, proveedor: proveedorActivo(), jobs: job.activo() });
}

module.exports = { listar, ejecutar, estado };
