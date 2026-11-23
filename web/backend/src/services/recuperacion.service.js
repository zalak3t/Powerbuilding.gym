// Recuperación de contraseña (alumnos y administradores).
// - El token es aleatorio (32 bytes, CSPRNG) y NO es un JWT: no lleva datos y no se puede reutilizar.
// - En la base de datos solo se guarda su hash SHA-256 (tabla password_resets, migración 008).
// - Vale 30 minutos y es de un solo uso; pedir uno nuevo invalida los anteriores.
// - Máximo 3 solicitudes por hora por cuenta (evita inundar de correos a una persona).
const crypto = require('crypto');
const { query } = require('../config/db');
const { withTransaction } = require('../utils/tx');
const { hashPassword } = require('./auth.service');
const { enviarCorreoSinRegistro } = require('./email.service');

const TTL_MINUTOS = 30;
const MAX_SOLICITUDES_HORA = 3;
const FORMATO_TOKEN = /^[A-Za-z0-9_-]{43}$/; // base64url de 32 bytes

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function baseFrontend() {
  return String(process.env.FRONTEND_URL || '').replace(/\/+$/, '');
}

// Crea el token de una cuenta y envía el correo. Devuelve { enviado, estado, enlace } o null si
// no corresponde enviar (cuenta inexistente, desactivada o con demasiadas solicitudes).
// El controlador responde siempre lo mismo, exista o no la cuenta.
async function solicitarRecuperacion(email) {
  const r = await query(
    'SELECT id, nombre, email, activo FROM usuarios WHERE email = $1',
    [String(email).trim().toLowerCase()]
  );
  const user = r.rows[0];
  if (!user || !user.activo) return null;

  const recientes = await query(
    `SELECT COUNT(*)::int AS n FROM password_resets
      WHERE usuario_id = $1 AND creado_en > NOW() - INTERVAL '1 hour'`,
    [user.id]
  );
  if (recientes.rows[0].n >= MAX_SOLICITUDES_HORA) return null;

  const token = crypto.randomBytes(32).toString('base64url');
  await withTransaction(async (client) => {
    // Un enlace nuevo deja sin efecto los anteriores que no se hayan usado.
    await client.query(
      'UPDATE password_resets SET usado_en = NOW() WHERE usuario_id = $1 AND usado_en IS NULL',
      [user.id]
    );
    await client.query(
      `INSERT INTO password_resets (usuario_id, token_hash, expira_en)
       VALUES ($1, $2, NOW() + ($3 || ' minutes')::interval)`,
      [user.id, hashToken(token), String(TTL_MINUTOS)]
    );
  });

  // El token viaja en el fragmento (#): el navegador no lo envía a ningún servidor ni lo filtra por Referer.
  const enlace = `${baseFrontend()}/restablecer.html#t=${token}`;
  const envio = await enviarCorreoSinRegistro({
    destinatario: user.email,
    asunto: 'Restablece tu contraseña en Powerbuilding.gym',
    texto: `Hola ${user.nombre},\n\nRecibimos una solicitud para restablecer la contraseña de tu cuenta en Powerbuilding.gym. Abre este enlace para elegir una nueva (vale ${TTL_MINUTOS} minutos y se puede usar una sola vez):\n\n${enlace}\n\nSi no fuiste tú, ignora este mensaje: tu contraseña no cambia.`,
  });
  return { estado: envio.estado, enlace };
}

// Cambia la contraseña si el token es válido. Devuelve true o false (sin distinguir el motivo:
// inexistente, vencido o ya usado, para no dar pistas).
async function restablecerContrasena(token, nuevaPassword) {
  if (typeof token !== 'string' || !FORMATO_TOKEN.test(token)) return false;
  const passwordHash = await hashPassword(nuevaPassword);

  const usuario = await withTransaction(async (client) => {
    // Un solo UPDATE condicional: si dos solicitudes llegan a la vez, solo una gana.
    const t = await client.query(
      `UPDATE password_resets SET usado_en = NOW()
        WHERE token_hash = $1 AND usado_en IS NULL AND expira_en > NOW()
        RETURNING usuario_id`,
      [hashToken(token)]
    );
    if (!t.rows[0]) return null;
    const u = await client.query(
      `UPDATE usuarios SET password_hash = $1, actualizado_en = NOW()
        WHERE id = $2 AND activo = TRUE RETURNING id, nombre, email`,
      [passwordHash, t.rows[0].usuario_id]
    );
    if (!u.rows[0]) return null;
    await client.query(
      'UPDATE password_resets SET usado_en = NOW() WHERE usuario_id = $1 AND usado_en IS NULL',
      [u.rows[0].id]
    );
    return u.rows[0];
  });
  if (!usuario) return false;

  // Aviso al dueño de la cuenta (mejor esfuerzo: nunca lanza).
  await enviarCorreoSinRegistro({
    destinatario: usuario.email,
    asunto: 'Tu contraseña de Powerbuilding.gym fue cambiada',
    texto: `Hola ${usuario.nombre},\n\nTe avisamos que la contraseña de tu cuenta en Powerbuilding.gym fue cambiada hace un momento.\n\nSi fuiste tú, no necesitas hacer nada. Si no fuiste tú, solicita un nuevo restablecimiento desde "¿Olvidaste tu contraseña?" y avisa al gimnasio.`,
  });
  return true;
}

module.exports = { solicitarRecuperacion, restablecerContrasena, hashToken, TTL_MINUTOS };
