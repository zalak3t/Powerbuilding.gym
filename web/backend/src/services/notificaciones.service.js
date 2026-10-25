const { getPlantillaByClave } = require('./plantillas.service');
const { enviarCorreo } = require('./email.service');
const { reemplazarVariables } = require('../utils/plantillas');

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

module.exports = { enviarPlantilla };
