const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { query } = require('../config/db');
const { withTransaction } = require('../utils/tx');

const SALT_ROUNDS = 12;
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

async function hashPassword(password) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

async function verifyPassword(password, passwordHash) {
  return bcrypt.compare(password, passwordHash);
}

function generateToken(user) {
  if (!JWT_SECRET) throw new Error('JWT_SECRET no configurado');
  return jwt.sign(
    { id: user.id, email: user.email, rol: user.rol, nombre: user.nombre },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

async function findUserByEmail(email) {
  const result = await query(
    'SELECT id, nombre, email, telefono, password_hash, rol, activo FROM usuarios WHERE email = $1',
    [email.toLowerCase()]
  );
  return result.rows[0] || null;
}

async function getUserById(id) {
  const result = await query(
    'SELECT id, nombre, email, telefono, rol, activo FROM usuarios WHERE id = $1',
    [id]
  );
  return result.rows[0] || null;
}

// ¿Existe una ficha creada por el administrador con este correo y sin cuenta asociada?
// Si existe, el registro NO puede enlazarla sin que la persona confirme el correo.
async function existeFichaSinCuenta(email) {
  const r = await query(
    `SELECT 1 FROM clientes WHERE email = $1 AND usuario_id IS NULL AND estado <> 'eliminado'`,
    [email.toLowerCase()]
  );
  return r.rows.length > 0;
}

// Crea usuario + cliente en una transacción.
// - vincularFicha = false (registro normal): solo se usa cuando NO existe una ficha con ese correo.
// - vincularFicha = true (correo ya verificado): si el admin había creado una ficha con ese
//   correo y sin cuenta, se enlaza al usuario nuevo (conserva sus pagos, notas y estado).
async function createUserWithClient(data, { vincularFicha = false } = {}) {
  const { nombre, email, telefono } = data;
  const emailLower = email.toLowerCase();
  const passwordHash = data.passwordHash || await hashPassword(data.password);

  return withTransaction(async (client) => {
    const userResult = await client.query(
      `INSERT INTO usuarios (nombre, email, telefono, password_hash, rol)
       VALUES ($1, $2, $3, $4, 'alumno')
       RETURNING id, nombre, email, rol`,
      [nombre, emailLower, telefono || null, passwordHash]
    );
    const user = userResult.rows[0];

    let enlazada = false;
    if (vincularFicha) {
      const up = await client.query(
        `UPDATE clientes SET usuario_id = $1, actualizado_en = NOW()
         WHERE email = $2 AND usuario_id IS NULL AND estado <> 'eliminado'`,
        [user.id, emailLower]
      );
      enlazada = up.rowCount > 0;
    }
    if (!enlazada) {
      await client.query(
        `INSERT INTO clientes (usuario_id, nombre, email, telefono)
         VALUES ($1, $2, $3, $4)`,
        [user.id, nombre, emailLower, telefono || null]
      );
    }

    return { ...user, fichaEnlazada: enlazada };
  });
}

// ── Verificación de correo (sin estado en la base de datos) ──────────────────
// El token firmado lleva los datos del registro pendiente (incluido el hash bcrypt de la clave,
// nunca la clave en claro). Se firma con una clave derivada, distinta de la de las sesiones,
// así un token de verificación no sirve como token de sesión ni al revés.
const VERIFICACION_TTL = '24h';

function claveVerificacion() {
  if (!JWT_SECRET) throw new Error('JWT_SECRET no configurado');
  return crypto.createHmac('sha256', JWT_SECRET).update('verificacion-correo-v1').digest();
}

async function generarTokenVerificacion({ nombre, email, telefono, password }) {
  const passwordHash = await hashPassword(password);
  return jwt.sign(
    { n: nombre, e: email.toLowerCase(), t: telefono || null, h: passwordHash },
    claveVerificacion(),
    { expiresIn: VERIFICACION_TTL, audience: 'verificar-correo' }
  );
}

// Devuelve { nombre, email, telefono, passwordHash } o null si el token no es válido o venció.
function leerTokenVerificacion(token) {
  try {
    const p = jwt.verify(token, claveVerificacion(), { audience: 'verificar-correo' });
    if (!p.n || !p.e || !p.h) return null;
    return { nombre: p.n, email: p.e, telefono: p.t, passwordHash: p.h };
  } catch {
    return null;
  }
}

module.exports = {
  hashPassword, verifyPassword, generateToken, findUserByEmail, getUserById,
  existeFichaSinCuenta, createUserWithClient, generarTokenVerificacion, leerTokenVerificacion,
};
