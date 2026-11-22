// Envoltorio de la API de Mercado Pago (Checkout Pro) para el pago en linea.
// Seguridad: solo se habilita en MODO PRUEBA. Mercado Pago entrega hoy el token de pruebas con el
// prefijo APP_USR- (igual que el de produccion), asi que el prefijo ya no distingue uno de otro.
// Por eso se exige MP_MODO_PRUEBA=1 como declaracion explicita ademas de MP_HABILITADO=1.
// Ver mercadopagoHabilitado().
// No registra ni devuelve el token. La confirmacion de un pago SIEMPRE se hace consultando su API.

const API = 'https://api.mercadopago.com';
const TIMEOUT_MS = 15000;

let fetchInyectado = null; // pruebas: funcion con la misma firma que fetch
function setFetchMercadoPago(f) { fetchInyectado = f || null; }

function token() { return String(process.env.MP_ACCESS_TOKEN || '').trim(); }

// Un token valido de Mercado Pago empieza con TEST- (formato antiguo de pruebas) o APP_USR-.
function formatoTokenValido(t) { return /^(TEST|APP_USR)-/.test(t); }
// Solo el formato antiguo TEST- se reconoce como prueba por si mismo.
function esCredencialPrueba(t) { return /^TEST-/.test(t); }

async function llamar(path, { method = 'GET', body } = {}) {
  const f = fetchInyectado || fetch;
  const resp = await f(API + path, {
    method,
    headers: {
      Authorization: 'Bearer ' + token(),
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  let data = null;
  try { data = await resp.json(); } catch (e) { data = null; }
  if (!resp.ok) {
    // Sin cuerpo ni token en el mensaje: solo el codigo HTTP.
    throw new Error('Mercado Pago respondio ' + resp.status);
  }
  return data;
}

// Crea la preferencia de pago. -> { id, url } (url = checkout de prueba mientras la credencial sea TEST-).
async function crearPreferencia({ buyOrder, titulo, monto, backUrl, notificationUrl }) {
  const data = await llamar('/checkout/preferences', {
    method: 'POST',
    body: {
      items: [{ title: titulo, quantity: 1, unit_price: monto, currency_id: 'CLP' }],
      external_reference: buyOrder,
      back_urls: { success: backUrl, pending: backUrl, failure: backUrl },
      auto_return: 'approved',
      notification_url: notificationUrl,
    },
  });
  if (!data || !data.id) throw new Error('Respuesta incompleta de Mercado Pago');
  const url = esCredencialPrueba(token()) ? data.sandbox_init_point : data.init_point; // con APP_USR- de pruebas se paga entrando con la cuenta Comprador de prueba
  if (!url) throw new Error('Mercado Pago no devolvió la URL de pago');
  return { id: String(data.id), url };
}

// Consulta un pago por su id. -> { id, status, status_detail, transaction_amount, currency_id, external_reference }
async function obtenerPago(paymentId) {
  if (!/^\d{1,20}$/.test(String(paymentId))) throw new Error('ID de pago inválido');
  const p = await llamar('/v1/payments/' + paymentId);
  if (!p || String(p.id) !== String(paymentId)) throw new Error('Pago no encontrado');
  return {
    id: String(p.id),
    status: p.status,
    status_detail: p.status_detail,
    transaction_amount: Number(p.transaction_amount),
    currency_id: p.currency_id,
    external_reference: p.external_reference,
    date_approved: p.date_approved,
  };
}

// Mercado Pago solo se habilita con MP_HABILITADO=1, MP_MODO_PRUEBA=1 y un token con formato valido.
// Sin MP_MODO_PRUEBA=1 el metodo queda deshabilitado aunque haya token (evita cobros reales por error).
function mercadopagoHabilitado() {
  if (String(process.env.MP_HABILITADO || '') !== '1') return false;
  if (String(process.env.MP_MODO_PRUEBA || '') !== '1') {
    console.warn('[mercadopago] falta MP_MODO_PRUEBA=1; el metodo queda deshabilitado (solo se permite modo prueba).');
    return false;
  }
  const t = token();
  if (!t) return false;
  if (!formatoTokenValido(t)) {
    console.warn('[mercadopago] MP_ACCESS_TOKEN con formato no valido; el metodo queda deshabilitado.');
    return false;
  }
  return true;
}

module.exports = { crearPreferencia, obtenerPago, mercadopagoHabilitado, setFetchMercadoPago, esCredencialPrueba };
