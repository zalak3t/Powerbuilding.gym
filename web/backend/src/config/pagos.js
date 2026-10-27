// Configuracion del pago en linea y del documento. Se lee en cada llamada (no al cargar el modulo)
// para poder cambiarla sin reiniciar. Nunca imprime claves.

const PROVEEDORES_PAGO = ['off', 'webpay_integracion'];

// Camino de produccion preparado pero DESACTIVADO: no se habilita hasta una decision explicita.
const PRODUCCION_HABILITADA = false;

function proveedorPagos() {
  const p = String(process.env.PAGOS_PROVIDER || 'off').trim().toLowerCase();
  if (p === 'webpay_produccion') {
    return PRODUCCION_HABILITADA ? 'webpay_produccion' : 'off';
  }
  return PROVEEDORES_PAGO.includes(p) ? p : 'off';
}

function pagosHabilitados() {
  return proveedorPagos() !== 'off';
}

// 'openfactura_dev' no esta implementado (endpoint de emision no confirmado en la documentacion
// oficial): se usa 'simulado' y se avisa una vez.
let avisoBoleta = false;
function proveedorBoleta() {
  const b = String(process.env.BOLETA_PROVIDER || 'simulado').trim().toLowerCase();
  if (b === 'openfactura_dev' && !avisoBoleta) {
    avisoBoleta = true;
    console.warn('[pagos] BOLETA_PROVIDER=openfactura_dev no esta implementado; se usa "simulado".');
  }
  return 'simulado';
}

function frontendUrl() {
  return String(process.env.FRONTEND_URL || 'http://localhost:8080').replace(/\/+$/, '');
}

function backendPublicUrl() {
  return String(process.env.BACKEND_PUBLIC_URL || ('http://localhost:' + (process.env.PORT || 3000))).replace(/\/+$/, '');
}

module.exports = {
  PRODUCCION_HABILITADA, proveedorPagos, pagosHabilitados, proveedorBoleta, frontendUrl, backendPublicUrl,
};
