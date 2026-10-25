const { query } = require('../config/db');
const { withTransaction } = require('../utils/tx');
const { hashPassword } = require('./auth.service');

// Nunca se selecciona password_hash.
const COLS = 'id, nombre, email, telefono, activo, creado_en, actualizado_en';

async function getAdmins() {
  const result = await query(`SELECT ${COLS} FROM usuarios WHERE rol = 'admin' ORDER BY nombre ASC`);
  return result.rows;
}

async function createAdmin({ nombre, email, telefono, password }) {
  const passwordHash = await hashPassword(password);
  const result = await query(
    `INSERT INTO usuarios (nombre, email, telefono, password_hash, rol)
     VALUES ($1, $2, $3, $4, 'admin')
     RETURNING ${COLS}`,
    [nombre, email, telefono, passwordHash]
  );
  return result.rows[0];
}

// Bloquea (FOR UPDATE) las filas de admins activos para serializar cambios concurrentes
// y devuelve sus ids. Dentro de una transacción.
async function lockAdminsActivos(client) {
  const r = await client.query(`SELECT id FROM usuarios WHERE rol = 'admin' AND activo = TRUE FOR UPDATE`);
  return r.rows.map((x) => x.id);
}

async function getAdminForUpdate(client, id) {
  const r = await client.query(`SELECT ${COLS} FROM usuarios WHERE id = $1 AND rol = 'admin' FOR UPDATE`, [id]);
  return r.rows[0] || null;
}

// Devuelve { admin } o { error: 'NOT_FOUND' | 'SELF' | 'LAST' }.
async function updateAdmin(id, actorId, { nombre, email, telefono, activo, password }) {
  const passwordHash = password ? await hashPassword(password) : null;

  return withTransaction(async (client) => {
    const activos = await lockAdminsActivos(client);
    const actual = await getAdminForUpdate(client, id);
    if (!actual) return { error: 'NOT_FOUND' };

    const nuevoActivo = activo === undefined ? actual.activo : activo;
    if (actual.activo && !nuevoActivo) {
      if (id === actorId) return { error: 'SELF' };
      if (activos.length <= 1) return { error: 'LAST' };
    }

    const r = await client.query(
      `UPDATE usuarios
       SET nombre=$1, email=$2, telefono=$3, activo=$4,
           password_hash = COALESCE($5, password_hash), actualizado_en=NOW()
       WHERE id=$6
       RETURNING ${COLS}`,
      [nombre, email, telefono, nuevoActivo, passwordHash, id]
    );
    return { admin: r.rows[0] };
  });
}

// Devuelve { ok: true } o { error: 'NOT_FOUND' | 'SELF' | 'LAST' | 'HAS_CLIENT' }.
async function deleteAdmin(id, actorId) {
  return withTransaction(async (client) => {
    const activos = await lockAdminsActivos(client);
    const actual = await getAdminForUpdate(client, id);
    if (!actual) return { error: 'NOT_FOUND' };
    if (id === actorId) return { error: 'SELF' };
    if (actual.activo && activos.length <= 1) return { error: 'LAST' };

    const c = await client.query('SELECT 1 FROM clientes WHERE usuario_id = $1 LIMIT 1', [id]);
    if (c.rows.length) return { error: 'HAS_CLIENT' };

    await client.query('DELETE FROM usuarios WHERE id = $1', [id]);
    return { ok: true };
  });
}

module.exports = { getAdmins, createAdmin, updateAdmin, deleteAdmin };
