const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
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

// Crea usuario + cliente en una transacción. Si el admin ya había creado un cliente con ese
// email sin usuario asociado, se vincula al usuario nuevo (conserva sus notas/estado).
async function createUserWithClient(data) {
  const { nombre, email, telefono, password } = data;
  const emailLower = email.toLowerCase();
  const passwordHash = await hashPassword(password);

  return withTransaction(async (client) => {
    const userResult = await client.query(
      `INSERT INTO usuarios (nombre, email, telefono, password_hash, rol)
       VALUES ($1, $2, $3, $4, 'alumno')
       RETURNING id, nombre, email, rol`,
      [nombre, emailLower, telefono || null, passwordHash]
    );
    const user = userResult.rows[0];

    await client.query(
      `INSERT INTO clientes (usuario_id, nombre, email, telefono)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (email) DO UPDATE
         SET usuario_id = EXCLUDED.usuario_id, actualizado_en = NOW()
         WHERE clientes.usuario_id IS NULL`,
      [user.id, nombre, emailLower, telefono || null]
    );

    return user;
  });
}

module.exports = { hashPassword, verifyPassword, generateToken, findUserByEmail, getUserById, createUserWithClient };
