const { query } = require('../config/db');
const { escaparHtml } = require('../utils/plantillas');

const BREVO_URL = 'https://api.brevo.com/v3/smtp/email';
const TIMEOUT_MS = 10000;
const MAX_ASUNTO = 150;

// Se leen en cada llamada (no al cargar el módulo) para poder cambiarlas sin reiniciar.
function config() {
  return {
    provider: String(process.env.EMAIL_PROVIDER || 'simulado').toLowerCase(),
    apiKey: process.env.EMAIL_API_KEY || '',
    from: process.env.EMAIL_FROM || '',
    fromName: process.env.EMAIL_FROM_NAME || 'Powerbuilding.gym',
  };
}

// Proveedor efectivo: brevo solo si está completo; si no, simulado. Nunca expone la clave.
function proveedorActivo() {
  const c = config();
  return c.provider === 'brevo' && c.apiKey && c.from ? 'brevo' : 'simulado';
}

// Sin saltos de línea (evita inyección de cabeceras) y con largo acotado.
function sanearAsunto(asunto) {
  return String(asunto === undefined || asunto === null ? '' : asunto)
    .replace(/\s+/g, ' ').trim().slice(0, MAX_ASUNTO);
}

// Texto plano -> HTML seguro con <br>.
function textoAHtml(texto) {
  return '<div>' + escaparHtml(texto).replace(/\r\n|\r|\n/g, '<br>') + '</div>';
}

// Quita la clave de cualquier texto antes de guardarlo o mostrarlo.
function sinSecretos(texto, apiKey) {
  let s = String(texto === undefined || texto === null ? '' : texto);
  if (apiKey) s = s.split(apiKey).join('[oculto]');
  return s.slice(0, 500);
}

async function llamarBrevo(c, { destinatario, asunto, html }) {
  const resp = await fetch(BREVO_URL, {
    method: 'POST',
    headers: { 'api-key': c.apiKey, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      sender: { name: c.fromName, email: c.from },
      to: [{ email: destinatario }],
      subject: asunto,
      htmlContent: html,
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!resp.ok) {
    let cuerpo = '';
    try { cuerpo = await resp.text(); } catch (e) { /* sin cuerpo */ }
    throw new Error('Brevo respondió ' + resp.status + (cuerpo ? ': ' + cuerpo : ''));
  }
}

async function registrar({ tipo, clienteId, destinatario, asunto, estado, detalle, claveUnica }) {
  const r = await query(
    `INSERT INTO notificaciones_log (tipo, cliente_id, destinatario, asunto, estado, detalle, clave_unica)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     ON CONFLICT (clave_unica) DO NOTHING RETURNING id`,
    [tipo, clienteId || null, destinatario, asunto, estado, detalle || null, claveUnica || null]
  );
  return r.rows.length > 0;
}

async function existeClave(claveUnica) {
  const r = await query('SELECT 1 FROM notificaciones_log WHERE clave_unica = $1', [claveUnica]);
  return r.rows.length > 0;
}

/**
 * Envía (o simula) un correo y lo registra en notificaciones_log. NUNCA lanza:
 * cualquier fallo queda como estado 'error'. Devuelve { estado, duplicado }.
 * Si claveUnica ya existe en el registro no envía nada (duplicado: true).
 */
async function enviarCorreo({ tipo, clienteId, destinatario, asunto, texto, claveUnica, forzarError }) {
  const c = config();
  const asuntoLimpio = sanearAsunto(asunto);
  try {
    if (claveUnica && await existeClave(claveUnica)) return { estado: null, duplicado: true };

    let estado;
    let detalle = null;
    if (forzarError) {
      // Plantilla inactiva u otro motivo para no enviar: solo se registra.
      estado = 'error';
      detalle = sinSecretos(forzarError, c.apiKey);
    } else if (proveedorActivo() === 'brevo') {
      try {
        await llamarBrevo(c, { destinatario, asunto: asuntoLimpio, html: textoAHtml(texto) });
        estado = 'enviado';
      } catch (e) {
        estado = 'error';
        detalle = sinSecretos(e && e.name === 'TimeoutError' ? 'Timeout al contactar al proveedor' : (e && e.message), c.apiKey);
      }
    } else {
      estado = 'simulado';
      detalle = 'Proveedor simulado: no se envió correo real';
    }

    const insertada = await registrar({ tipo, clienteId, destinatario, asunto: asuntoLimpio, estado, detalle, claveUnica });
    return { estado, duplicado: !insertada };
  } catch (e) {
    // Fallo del propio registro: no debe romper la operación que lo originó.
    console.error('[email] no se pudo registrar la notificación:', sinSecretos(e && e.message, c.apiKey));
    return { estado: 'error', duplicado: false };
  }
}

module.exports = { enviarCorreo, proveedorActivo, sanearAsunto, textoAHtml };
