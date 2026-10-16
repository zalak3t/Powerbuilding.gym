const { query } = require('../config/db');

async function getClienteActivoByUserId(userId) {
  const result = await query(
    'SELECT id, estado FROM clientes WHERE usuario_id = $1',
    [userId]
  );
  return result.rows[0] || null;
}

async function getBloqueCap(bloqueId) {
  const result = await query(
    `SELECT b.id, b.estado, b.capacidad, COUNT(r.id)::int AS inscritos
     FROM bloques b
     LEFT JOIN reservas r ON r.bloque_id = b.id
     WHERE b.id = $1
     GROUP BY b.id`,
    [bloqueId]
  );
  return result.rows[0] || null;
}

async function createReserva({ clienteId, bloqueId }) {
  const result = await query(
    `INSERT INTO reservas (cliente_id, bloque_id)
     VALUES ($1, $2)
     RETURNING id, cliente_id, bloque_id`,
    [clienteId, bloqueId]
  );
  return result.rows[0];
}

async function getReservaById(reservaId) {
  const result = await query(
    `SELECT r.id, r.cliente_id, r.bloque_id, c.usuario_id
     FROM reservas r
     JOIN clientes c ON c.id = r.cliente_id
     WHERE r.id = $1`,
    [reservaId]
  );
  return result.rows[0] || null;
}

async function deleteReserva(reservaId) {
  await query('DELETE FROM reservas WHERE id = $1', [reservaId]);
}

module.exports = { getClienteActivoByUserId, getBloqueCap, createReserva, getReservaById, deleteReserva };
