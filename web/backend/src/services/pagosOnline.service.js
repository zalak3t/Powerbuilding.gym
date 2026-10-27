// Pago en linea con Webpay Plus: iniciar, retorno (idempotente), documento y correo.
// El monto sale SIEMPRE de planes.precio. Nunca se guardan datos de tarjeta ni se registra el token en logs.
const crypto = require('crypto');
const { query } = require('../config/db');
const { withTransaction } = require('../utils/tx');
const { HOY_CL_SQL, hoyChile } = require('../utils/fechas');
const webpay = require('./webpay.service');
const { proveedorPagos, proveedorBoleta, backendPublicUrl } = require('../config/pagos');
const { createPago, getPagoById } = require('./pagos.service');
const { generarComprobante, folioComprobante, clp } = require('./comprobante.service');
const { enviarPlantilla } = require('./notificaciones.service');

// Lista blanca de la respuesta del proveedor que se conserva (sin card_detail ni vci).
const CAMPOS_RESPUESTA = [
  'status', 'response_code', 'authorization_code', 'payment_type_code', 'installments_number',
  'transaction_date', 'accounting_date', 'amount', 'buy_order',
];
function sanitizarRespuesta(r) {
  const out = {};
  CAMPOS_RESPUESTA.forEach((k) => { if (r && r[k] !== undefined) out[k] = r[k]; });
  return out;
}

function nuevoBuyOrder() {
  return ('PB' + Date.now().toString(36) + crypto.randomBytes(4).toString('hex')).slice(0, 26);
}

function msg(e) { return String((e && e.message) || e || 'Error').slice(0, 300); }

const TX_SELECT = `
  SELECT t.id, t.cliente_id, c.nombre AS cliente_nombre, c.usuario_id,
         t.plan_id, pl.nombre AS plan_nombre, t.monto, t.proveedor, t.buy_order, t.estado, t.detalle,
         t.pago_id, t.creado_en, t.finalizado_en,
         to_char(pg.periodo_desde, 'YYYY-MM-DD') AS periodo_desde,
         to_char(pg.periodo_hasta, 'YYYY-MM-DD') AS periodo_hasta,
         d.estado AS documento_estado, d.folio AS documento_folio, d.enviado_en AS documento_enviado_en,
         d.detalle AS documento_detalle, (d.pdf IS NOT NULL) AS documento_disponible
  FROM transacciones_pago t
  JOIN clientes c ON c.id = t.cliente_id
  JOIN planes pl ON pl.id = t.plan_id
  LEFT JOIN pagos pg ON pg.id = t.pago_id
  LEFT JOIN documentos_pago d ON d.pago_id = t.pago_id AND d.tipo = 'comprobante'`;

async function getTransaccion(id) {
  const r = await query(TX_SELECT + ' WHERE t.id = $1', [id]);
  return r.rows[0] || null;
}

async function listarTransacciones({ estado, limit }) {
  const r = await query(
    TX_SELECT + ` WHERE ($1::text IS NULL OR t.estado = $1) ORDER BY t.creado_en DESC, t.id DESC LIMIT $2`,
    [estado || null, limit]
  );
  return r.rows;
}

async function getClientePorUsuario(userId) {
  const r = await query('SELECT id, nombre, email, estado FROM clientes WHERE usuario_id = $1', [userId]);
  return r.rows[0] || null;
}

async function listarPlanesActivos() {
  const r = await query(
    `SELECT id, nombre, descripcion, beneficios, duracion_dias, precio
     FROM planes WHERE activo = TRUE AND precio > 0 ORDER BY precio ASC, id ASC`
  );
  return r.rows;
}

/**
 * Crea la transaccion y la inicia en Webpay. Devuelve { id, url, token } o
 * { error: 'PLAN_NOT_FOUND' | 'PLAN_INACTIVE' | 'PLAN_SIN_PRECIO' | 'PROVEEDOR' }.
 */
async function iniciarPago({ cliente, planId }) {
  const plan = (await query('SELECT id, precio, activo FROM planes WHERE id = $1', [planId])).rows[0];
  if (!plan) return { error: 'PLAN_NOT_FOUND' };
  if (!plan.activo) return { error: 'PLAN_INACTIVE' };
  if (!(plan.precio > 0)) return { error: 'PLAN_SIN_PRECIO' };

  const buyOrder = nuevoBuyOrder();
  const ins = await query(
    `INSERT INTO transacciones_pago (cliente_id, plan_id, monto, proveedor, buy_order)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [cliente.id, plan.id, plan.precio, proveedorPagos(), buyOrder]
  );
  const id = ins.rows[0].id;

  try {
    const r = await webpay.crearTransaccion({
      buyOrder,
      sessionId: 'cliente-' + cliente.id,
      monto: plan.precio,
      returnUrl: backendPublicUrl() + '/api/pagos-online/retorno',
    });
    if (!r || !r.token || !r.url) throw new Error('Respuesta incompleta del proveedor');
    await query('UPDATE transacciones_pago SET token = $1, actualizado_en = NOW() WHERE id = $2', [r.token, id]);
    return { id, url: r.url, token: r.token };
  } catch (e) {
    console.error('[pagos-online] no se pudo iniciar la transacción ' + id + ': ' + msg(e));
    await query(
      `UPDATE transacciones_pago SET estado = 'rechazada', detalle = $1, finalizado_en = NOW(), actualizado_en = NOW() WHERE id = $2`,
      ['No se pudo iniciar el pago con el proveedor', id]
    );
    return { error: 'PROVEEDOR' };
  }
}

// periodo_desde de un pago nuevo: dia siguiente al fin del periodo vigente, o hoy.
async function periodoDesdeCliente(client, clienteId) {
  const r = await client.query(
    `SELECT to_char(CASE WHEN MAX(periodo_hasta) >= ${HOY_CL_SQL} THEN MAX(periodo_hasta) + 1
                         ELSE ${HOY_CL_SQL} END, 'YYYY-MM-DD') AS desde
     FROM pagos WHERE cliente_id = $1 AND estado = 'pagado'`,
    [clienteId]
  );
  return r.rows[0].desde;
}

async function cerrarTx(client, id, estado, detalle, respuesta, pagoId) {
  await client.query(
    `UPDATE transacciones_pago
     SET estado = $1, detalle = $2, respuesta = $3, pago_id = $4, finalizado_en = NOW(), actualizado_en = NOW()
     WHERE id = $5`,
    [estado, detalle || null, respuesta ? JSON.stringify(respuesta) : null, pagoId || null, id]
  );
}

const esTexto = (x) => typeof x === 'string' && x.length > 0 && x.length <= 200;

/**
 * Procesa el retorno de Webpay (GET o POST). Devuelve { txId } (null si no se reconoce).
 * Idempotente: solo transiciona si la transaccion estaba 'iniciada' (bloqueo FOR UPDATE).
 * Precedencia: TBK_TOKEN (abortado) > token_ws (commit) > solo orden de compra (expirado).
 */
async function procesarRetorno(params) {
  const p = params || {};
  const tbkToken = esTexto(p.TBK_TOKEN) ? p.TBK_TOKEN : null;
  const tokenWs = esTexto(p.token_ws) ? p.token_ws : null;
  const ordenCompra = esTexto(p.TBK_ORDEN_COMPRA) ? p.TBK_ORDEN_COMPRA : null;
  const modo = tbkToken ? 'anulada' : (tokenWs ? 'commit' : (ordenCompra ? 'expirada' : null));
  if (!modo) return { txId: null };

  let pagoNuevo = null;
  const resultado = await withTransaction(async (client) => {
    const busca = modo === 'expirada'
      ? await client.query('SELECT * FROM transacciones_pago WHERE buy_order = $1 FOR UPDATE', [ordenCompra])
      : await client.query('SELECT * FROM transacciones_pago WHERE token = $1 FOR UPDATE', [tbkToken || tokenWs]);
    const tx = busca.rows[0];
    if (!tx) return { txId: null };
    if (tx.estado !== 'iniciada') return { txId: tx.id }; // retorno duplicado: no hace nada

    if (modo === 'anulada') {
      await cerrarTx(client, tx.id, 'anulada', 'Pago anulado por el cliente en Webpay');
      return { txId: tx.id };
    }
    if (modo === 'expirada') {
      await cerrarTx(client, tx.id, 'expirada', 'El cliente no completó el pago a tiempo');
      return { txId: tx.id };
    }

    // commit
    let r;
    try {
      r = await webpay.confirmar(tx.token);
    } catch (e) {
      try { r = await webpay.estado(tx.token); } catch (e2) { r = null; }
      if (!r) {
        console.error('[pagos-online] no se pudo confirmar la transacción ' + tx.id + ': ' + msg(e));
        await client.query(
          `UPDATE transacciones_pago SET detalle = $1, actualizado_en = NOW() WHERE id = $2`,
          ['No se pudo confirmar con el proveedor; reintentar o revisar', tx.id]
        );
        return { txId: tx.id }; // queda 'iniciada': el cobro, si existio, se puede recuperar
      }
    }

    const resp = sanitizarRespuesta(r);
    const aprobada = Number(r.response_code) === 0 && r.status === 'AUTHORIZED';
    if (!aprobada) {
      await cerrarTx(client, tx.id, 'rechazada', 'Pago rechazado por el proveedor', resp);
      return { txId: tx.id };
    }
    if (r.buy_order !== tx.buy_order || Number(r.amount) !== tx.monto) {
      console.error('[pagos-online] la transacción ' + tx.id + ' fue autorizada con datos que no coinciden; revisar manualmente');
      await cerrarTx(client, tx.id, 'rechazada', 'Los datos autorizados no coinciden con la transacción', resp);
      return { txId: tx.id };
    }

    const desde = await periodoDesdeCliente(client, tx.cliente_id);
    const cr = await createPago({
      clienteId: tx.cliente_id, planId: tx.plan_id, monto: tx.monto, metodo: 'webpay',
      fechaPago: hoyChile(), periodoDesde: desde, notas: 'Pago online Webpay, orden ' + tx.buy_order, origen: 'online',
    }, client);
    if (cr.error) throw new Error('No se pudo registrar el pago autorizado: ' + cr.error); // revierte; el retorno puede repetirse
    await cerrarTx(client, tx.id, 'autorizada', null, resp, cr.pago.id);
    pagoNuevo = cr.pago.id;
    return { txId: tx.id };
  });

  // Fuera de la transaccion: un fallo aqui NO revierte el pago.
  if (pagoNuevo) await emitirDocumento(pagoNuevo, { reintento: false });
  return resultado;
}

/**
 * Genera el comprobante (documentos_pago) y envia el correo 'pago_confirmado'. NUNCA lanza.
 * Si algo falla, el documento queda en estado 'error' con el detalle; el pago no se toca.
 */
async function emitirDocumento(pagoId, { reintento }) {
  const proveedor = proveedorBoleta();
  try {
    await query(
      `INSERT INTO documentos_pago (pago_id, tipo, proveedor, estado) VALUES ($1, 'comprobante', $2, 'pendiente')
       ON CONFLICT (pago_id, tipo) DO NOTHING`,
      [pagoId, proveedor]
    );
    const pago = await getPagoById(pagoId);
    const info = (await query(
      `SELECT c.id AS cliente_id, c.nombre, c.email, t.buy_order, t.respuesta
       FROM pagos pg JOIN clientes c ON c.id = pg.cliente_id
       LEFT JOIN transacciones_pago t ON t.pago_id = pg.id WHERE pg.id = $1`, [pagoId]
    )).rows[0];
    if (!pago || !info) throw new Error('Pago no encontrado');

    const doc = (await query(`SELECT estado, pdf FROM documentos_pago WHERE pago_id = $1 AND tipo = 'comprobante'`, [pagoId])).rows[0];
    const folio = folioComprobante(pagoId);
    let pdf = doc && doc.pdf;
    if (!pdf) {
      try {
        pdf = await generarComprobante({
          folio, fechaPago: pago.fecha_pago, clienteNombre: info.nombre, clienteEmail: info.email,
          planNombre: pago.plan_nombre, periodoDesde: pago.periodo_desde, periodoHasta: pago.periodo_hasta,
          monto: pago.monto, metodo: pago.metodo,
          autorizacion: info.respuesta && info.respuesta.authorization_code, ordenCompra: info.buy_order,
        });
      } catch (e) {
        await query(`UPDATE documentos_pago SET estado = 'error', detalle = $1 WHERE pago_id = $2 AND tipo = 'comprobante'`,
          ['No se pudo generar el comprobante: ' + msg(e), pagoId]);
        return { estado: 'error' };
      }
      await query(`UPDATE documentos_pago SET pdf = $1, folio = $2, proveedor = $3, estado = 'emitido', detalle = NULL
                   WHERE pago_id = $4 AND tipo = 'comprobante'`, [pdf, folio, proveedor, pagoId]);
    }

    // Correo. En un reintento se borra la fila 'error' previa para que su clave_unica no bloquee el reenvio.
    const clave = 'pago:' + pagoId;
    if (reintento) {
      await query(`DELETE FROM notificaciones_log WHERE clave_unica = $1 AND estado = 'error'`, [clave]);
    }
    const envio = await enviarPlantilla({
      clave: 'pago_confirmado',
      cliente: { id: info.cliente_id, nombre: info.nombre, email: info.email },
      datos: { plan: pago.plan_nombre, monto: clp(pago.monto), fecha_vencimiento: pago.periodo_hasta, folio },
      claveUnica: clave,
      adjuntos: [{ nombre: 'comprobante-' + folio + '.pdf', base64: pdf.toString('base64') }],
    });
    if (envio.estado === 'error') {
      await query(`UPDATE documentos_pago SET estado = 'error', detalle = $1 WHERE pago_id = $2 AND tipo = 'comprobante'`,
        ['El comprobante se generó pero el correo no se pudo enviar', pagoId]);
      return { estado: 'error' };
    }
    await query(`UPDATE documentos_pago SET estado = 'emitido', detalle = NULL,
                   enviado_en = COALESCE(enviado_en, NOW()) WHERE pago_id = $1 AND tipo = 'comprobante'`, [pagoId]);
    return { estado: 'emitido' };
  } catch (e) {
    console.error('[pagos-online] documento del pago ' + pagoId + ' falló:', msg(e));
    try {
      await query(`UPDATE documentos_pago SET estado = 'error', detalle = $1 WHERE pago_id = $2 AND tipo = 'comprobante'`,
        [msg(e), pagoId]);
    } catch (e2) { /* sin registro: el admin lo ve igual al reintentar */ }
    return { estado: 'error' };
  }
}

// PDF guardado del comprobante de una transaccion. -> { pdf, folio } o null.
async function getDocumentoPdf(txId) {
  const r = await query(
    `SELECT d.pdf, d.folio FROM transacciones_pago t
     JOIN documentos_pago d ON d.pago_id = t.pago_id AND d.tipo = 'comprobante'
     WHERE t.id = $1`, [txId]
  );
  const row = r.rows[0];
  return row && row.pdf ? { pdf: row.pdf, folio: row.folio } : null;
}

// Admin: reintenta documento y correo de una transaccion autorizada. -> { estado } o { error }.
async function reintentarDocumento(txId) {
  const tx = (await query('SELECT id, estado, pago_id FROM transacciones_pago WHERE id = $1', [txId])).rows[0];
  if (!tx) return { error: 'NOT_FOUND' };
  if (tx.estado !== 'autorizada' || !tx.pago_id) return { error: 'NO_AUTORIZADA' };
  return emitirDocumento(tx.pago_id, { reintento: true });
}

module.exports = {
  getClientePorUsuario, listarPlanesActivos, iniciarPago, procesarRetorno, emitirDocumento,
  getTransaccion, listarTransacciones, getDocumentoPdf, reintentarDocumento, sanitizarRespuesta,
};
