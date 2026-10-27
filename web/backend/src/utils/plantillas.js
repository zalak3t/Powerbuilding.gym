// Reemplazo de variables {{x}} en plantillas de notificación. Reutilizable por el bloque de correos.

// Variables disponibles y su descripción (se muestran en el panel).
const VARIABLES = {
  nombre: 'Nombre del cliente',
  dia: 'Día del bloque (ej: Lunes)',
  horario: 'Horario del bloque (ej: 07:00 - 08:30)',
  plan: 'Nombre del plan contratado',
  fecha_vencimiento: 'Fecha de vencimiento de la membresía (AAAA-MM-DD)',
  monto: 'Monto pagado (ej: $35.000)',
  folio: 'Folio del comprobante de pago (ej: CP-000123)',
  link_pago: 'Enlace para pagar o renovar el plan en línea',
};

// Datos de ejemplo para la vista previa.
const DATOS_EJEMPLO = {
  nombre: 'María González',
  dia: 'Lunes',
  horario: '19:00 - 20:30',
  plan: 'Plan Mensual',
  fecha_vencimiento: '2026-11-30',
  monto: '$35.000',
  folio: 'CP-000123',
  link_pago: 'https://tu-sitio.netlify.app/?pagar=1',
};

const VARIABLE_RE = /\{\{\s*([a-z_]+)\s*\}\}/gi;

// Escapa texto para insertarlo como HTML.
function escaparHtml(s) {
  return String(s === undefined || s === null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/**
 * Reemplaza {{variable}} por su valor en `datos`. Una variable sin dato se deja tal cual.
 * Con { escapar: true } los valores se escapan como HTML (para correos en HTML).
 * El texto de la plantilla no se modifica: si se muestra como HTML, escápalo aparte.
 */
function reemplazarVariables(texto, datos, opciones) {
  const escapar = !!(opciones && opciones.escapar);
  const d = datos || {};
  return String(texto === undefined || texto === null ? '' : texto).replace(VARIABLE_RE, (match, clave) => {
    const k = clave.toLowerCase();
    if (!Object.prototype.hasOwnProperty.call(d, k) || d[k] === undefined || d[k] === null) return match;
    return escapar ? escaparHtml(d[k]) : String(d[k]);
  });
}

module.exports = { VARIABLES, DATOS_EJEMPLO, reemplazarVariables, escaparHtml };
