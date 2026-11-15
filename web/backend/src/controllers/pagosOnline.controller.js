const svc = require('../services/pagosOnline.service');
const { getClienteById } = require('../services/clientes.service');
const { pagosHabilitados, proveedorPagos, frontendUrl } = require('../config/pagos');
const { mercadopagoHabilitado } = require('../services/mercadopago.service');
const v = require('../utils/validate');

const ESTADOS = ['iniciada', 'autorizada', 'rechazada', 'anulada', 'expirada'];
const LIMITE_DEFECTO = 50;
const LIMITE_MAX = 200;

// Vista publica de una transaccion (sin token, sin usuario_id).
function vista(t) {
  const { usuario_id, ...resto } = t; // eslint-disable-line no-unused-vars
  return resto;
}

// GET /api/pagos-online/estado
function estado(req, res) {
  const metodos = [];
  if (pagosHabilitados()) metodos.push('webpay');
  if (mercadopagoHabilitado()) metodos.push('mercadopago');
  res.json({ ok: true, habilitado: metodos.length > 0, metodos, proveedor: proveedorPagos() });
}

// GET /api/pagos-online/planes (alumno)
async function planes(req, res) {
  if (req.user.rol !== 'alumno') return res.status(403).json({ ok: false, error: 'Solo los alumnos pueden pagar en línea' });
  const cliente = await svc.getClientePorUsuario(req.user.id);
  if (!cliente) return res.status(404).json({ ok: false, error: 'Cliente no encontrado para este usuario' });
  const [lista, ficha] = await Promise.all([svc.listarPlanesActivos(), getClienteById(cliente.id)]);
  return res.json({
    ok: true,
    planes: lista,
    membresia: ficha ? { estado: ficha.estado_membresia, vence_el: ficha.vence_el } : null,
  });
}

const ERRORES_INICIAR = {
  PLAN_NOT_FOUND: [404, 'Plan no encontrado'],
  PLAN_INACTIVE: [409, 'El plan está inactivo; elige un plan activo'],
  PLAN_SIN_PRECIO: [409, 'El plan no tiene precio para pago en línea'],
  PROVEEDOR: [502, 'No se pudo iniciar el pago. Intenta nuevamente en unos minutos'],
  METODO_NO_DISPONIBLE: [503, 'El método de pago no está disponible'],
};

// POST /api/pagos-online/iniciar   body: { plan_id }
async function iniciar(req, res) {
  if (req.user.rol !== 'alumno') return res.status(403).json({ ok: false, error: 'Solo los alumnos pueden pagar en línea' });

  const body = req.body || {};
  const planId = v.parsePositiveInt(body.plan_id);
  if (!planId) return res.status(400).json({ ok: false, error: 'plan_id es obligatorio y debe ser válido' });
  const metodo = body.metodo === undefined ? 'webpay' : body.metodo;
  if (metodo !== 'webpay' && metodo !== 'mercadopago') {
    return res.status(400).json({ ok: false, error: 'metodo debe ser webpay o mercadopago' });
  }
  if (metodo === 'webpay' && !pagosHabilitados()) return res.status(503).json({ ok: false, error: 'Webpay no está disponible' });
  if (metodo === 'mercadopago' && !mercadopagoHabilitado()) return res.status(503).json({ ok: false, error: 'Mercado Pago no está disponible' });

  const cliente = await svc.getClientePorUsuario(req.user.id);
  if (!cliente) return res.status(404).json({ ok: false, error: 'Cliente no encontrado para este usuario' });
  // La identidad sale del token: un cliente_id distinto del propio se rechaza. El monto nunca viene del body.
  if (body.cliente_id !== undefined && body.cliente_id !== null && String(body.cliente_id) !== String(cliente.id)) {
    return res.status(403).json({ ok: false, error: 'No puedes pagar por otro cliente' });
  }
  if (cliente.estado !== 'activo') return res.status(403).json({ ok: false, error: 'Cliente no habilitado para pagar' });

  const r = await svc.iniciarPago({ cliente, planId, metodo });
  if (r.error) {
    const [status, error] = ERRORES_INICIAR[r.error] || [503, 'El método de pago no está disponible'];
    return res.status(status).json({ ok: false, error });
  }
  return res.status(201).json({ ok: true, id: r.id, url: r.url, token: r.token, metodo: r.metodo, redirect: r.redirect });
}

// GET|POST /api/pagos-online/retorno  (lo invoca el navegador al volver de Webpay)
async function retorno(req, res) {
  const params = Object.assign({}, req.query, req.body && typeof req.body === 'object' ? req.body : {});
  let txId = null;
  try {
    txId = (await svc.procesarRetorno(params)).txId;
  } catch (e) {
    console.error('[pagos-online] error al procesar el retorno:', e && e.message);
  }
  return res.redirect(303, frontendUrl() + '/pago-resultado.html?tx=' + (txId || 0));
}

// Mercado Pago redirige al alumno aquí al terminar. El pago se confirma consultando su API;
// el parámetro payment_id solo indica qué consultar, no se confía en él.
const PAYMENT_ID = /^\d{1,20}$/;
async function mpRetorno(req, res) {
  const paymentId = PAYMENT_ID.test(String(req.query.payment_id || req.query.collection_id || '')) ? String(req.query.payment_id || req.query.collection_id) : null;
  let txId = null;
  try {
    if (paymentId) txId = (await svc.confirmarMercadoPago(paymentId)).txId;
  } catch (e) {
    console.error('[pagos-online] error al confirmar Mercado Pago (retorno):', e && e.message);
  }
  return res.redirect(303, frontendUrl() + '/pago-resultado.html?tx=' + (txId || 0));
}

// Notificación de Mercado Pago (webhook). Siempre responde 200 para que no reintente sin fin;
// lo que no sea un pago conocido se ignora. Nada de lo recibido se da por cierto sin consultar la API.
async function mpNotificacion(req, res) {
  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const tipo = String(req.query.type || req.query.topic || body.type || body.topic || '');
    const id = (req.query['data.id'] !== undefined ? req.query['data.id'] : (body.data && body.data.id));
    if (tipo === 'payment' && PAYMENT_ID.test(String(id || ''))) {
      await svc.confirmarMercadoPago(String(id));
    }
  } catch (e) {
    console.error('[pagos-online] error al procesar notificación de Mercado Pago:', e && e.message);
  }
  return res.status(200).json({ ok: true });
}

// Carga la transaccion y valida acceso: alumno solo la suya. -> transaccion o null (ya respondio).
async function cargarAccesible(req, res) {
  const id = v.parsePositiveInt(req.params.id);
  if (!id) { res.status(400).json({ ok: false, error: 'ID inválido' }); return null; }
  const tx = await svc.getTransaccion(id);
  if (!tx) { res.status(404).json({ ok: false, error: 'Transacción no encontrada' }); return null; }
  if (req.user.rol !== 'admin' && tx.usuario_id !== req.user.id) {
    res.status(403).json({ ok: false, error: 'No tienes permiso para ver esta transacción' });
    return null;
  }
  return tx;
}

// GET /api/pagos-online/:id
async function obtener(req, res) {
  const tx = await cargarAccesible(req, res);
  if (!tx) return;
  return res.json({ ok: true, transaccion: vista(tx) });
}

// GET /api/pagos-online/:id/documento
async function documento(req, res) {
  const tx = await cargarAccesible(req, res);
  if (!tx) return;
  const doc = await svc.getDocumentoPdf(tx.id);
  if (!doc) return res.status(404).json({ ok: false, error: 'El comprobante aún no está disponible' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename="comprobante-' + (doc.folio || tx.id) + '.pdf"');
  return res.send(doc.pdf);
}

// GET /api/pagos-online (admin)
async function listar(req, res) {
  const { estado: est } = req.query;
  if (est !== undefined && est !== '' && !v.isOneOf(est, ESTADOS)) {
    return res.status(400).json({ ok: false, error: 'estado inválido' });
  }
  let limit = LIMITE_DEFECTO;
  if (req.query.limit !== undefined && req.query.limit !== '') {
    limit = v.parsePositiveInt(req.query.limit);
    if (!limit || limit > LIMITE_MAX) {
      return res.status(400).json({ ok: false, error: 'limit debe ser un entero entre 1 y ' + LIMITE_MAX });
    }
  }
  const lista = await svc.listarTransacciones({ estado: est || null, limit });
  return res.json({ ok: true, transacciones: lista.map(vista) });
}

// POST /api/pagos-online/:id/reintentar-documento (admin)
async function reintentarDocumento(req, res) {
  const id = v.parsePositiveInt(req.params.id);
  if (!id) return res.status(400).json({ ok: false, error: 'ID inválido' });
  const r = await svc.reintentarDocumento(id);
  if (r.error === 'NOT_FOUND') return res.status(404).json({ ok: false, error: 'Transacción no encontrada' });
  if (r.error === 'NO_AUTORIZADA') return res.status(409).json({ ok: false, error: 'La transacción no está autorizada' });
  const tx = await svc.getTransaccion(id);
  return res.json({
    ok: r.estado === 'emitido',
    message: r.estado === 'emitido' ? 'Documento y correo reenviados' : 'El documento sigue con error',
    transaccion: vista(tx),
  });
}

module.exports = { estado, planes, iniciar, retorno, mpRetorno, mpNotificacion, obtener, documento, listar, reintentarDocumento };
