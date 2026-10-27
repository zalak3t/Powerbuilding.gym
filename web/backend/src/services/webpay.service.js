// Envoltorio del SDK oficial de Transbank (transbank-sdk) para Webpay Plus.
// El SDK se carga de forma perezosa: sin el paquete instalado el resto del backend funciona y
// solo falla al intentar pagar. Las claves de INTEGRACION vienen del propio SDK (constantes),
// no se escriben aqui. El camino de produccion esta preparado pero desactivado (config/pagos.js).
const { proveedorPagos, PRODUCCION_HABILITADA } = require('../config/pagos');

const TIMEOUT_MS = 15000;

let clienteInyectado = null; // pruebas: objeto con create/commit/status como el SDK

// Solo para pruebas: reemplaza el SDK por un doble. null lo quita.
function setClienteWebpay(fake) { clienteInyectado = fake || null; }

function crearCliente() {
  if (clienteInyectado) return clienteInyectado;
  const prov = proveedorPagos();
  const sdk = require('transbank-sdk');
  const { WebpayPlus, Options, Environment, IntegrationCommerceCodes, IntegrationApiKeys } = sdk;

  if (prov === 'webpay_integracion') {
    return new WebpayPlus.Transaction(
      new Options(IntegrationCommerceCodes.WEBPAY_PLUS, IntegrationApiKeys.WEBPAY, Environment.Integration)
    );
  }
  if (prov === 'webpay_produccion' && PRODUCCION_HABILITADA) {
    // Preparado, DESACTIVADO: requiere WEBPAY_COMMERCE_CODE y WEBPAY_API_KEY en el entorno.
    return new WebpayPlus.Transaction(
      new Options(process.env.WEBPAY_COMMERCE_CODE, process.env.WEBPAY_API_KEY, Environment.Production)
    );
  }
  throw new Error('Pago en línea deshabilitado');
}

function conTimeout(promesa) {
  return Promise.race([
    promesa,
    new Promise((_, rej) => setTimeout(() => rej(new Error('Timeout al contactar a Webpay')), TIMEOUT_MS)),
  ]);
}

// -> { token, url }
async function crearTransaccion({ buyOrder, sessionId, monto, returnUrl }) {
  const tx = crearCliente();
  return conTimeout(Promise.resolve(tx.create(buyOrder, sessionId, monto, returnUrl)));
}

// -> respuesta del commit (status, response_code, amount, buy_order, authorization_code, ...)
async function confirmar(token) {
  const tx = crearCliente();
  return conTimeout(Promise.resolve(tx.commit(token)));
}

async function estado(token) {
  const tx = crearCliente();
  return conTimeout(Promise.resolve(tx.status(token)));
}

module.exports = { crearTransaccion, confirmar, estado, setClienteWebpay };
