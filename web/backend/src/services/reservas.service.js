const { query } = require('../config/db');
const { reservaVigente } = require('../utils/reservasSql');
const { withTransaction } = require('../utils/tx');

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
     LEFT JOIN reservas r ON r.bloque_id = b.id AND ${reservaVigente('r')}
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

// Reserva con control de cupo atómico. Bloquea la fila del bloque (FOR UPDATE) mientras cuenta los
// inscritos y inserta, así dos solicitudes simultáneas no pueden pasar el límite de capacidad.
// Devuelve { reserva } o { error: 'BLOQUE_NOT_FOUND' | 'BLOQUE_SUSPENDIDO' | 'BLOQUE_LLENO' }.
// Un duplicado (UNIQUE cliente/bloque) lanza el error 23505 de PostgreSQL, como antes.
async function reservarConCupo({ clienteId, bloqueId }) {
  return withTransaction(async (c) => {
    const b = await c.query(
      'SELECT id, estado, capacidad FROM bloques WHERE id = $1 FOR UPDATE',
      [bloqueId]
    );
    const bloque = b.rows[0];
    if (!bloque) return { error: 'BLOQUE_NOT_FOUND' };
    if (bloque.estado !== 'activo') return { error: 'BLOQUE_SUSPENDIDO' };

    const n = await c.query(
      `SELECT COUNT(r.id)::int AS inscritos FROM reservas r WHERE r.bloque_id = $1 AND ${reservaVigente('r')}`,
      [bloqueId]
    );
    if (n.rows[0].inscritos >= bloque.capacidad) return { error: 'BLOQUE_LLENO' };

    const ins = await c.query(
      `INSERT INTO reservas (cliente_id, bloque_id)
       VALUES ($1, $2)
       RETURNING id, cliente_id, bloque_id`,
      [clienteId, bloqueId]
    );
    return { reserva: ins.rows[0] };
  });
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

module.exports = { getClienteActivoByUserId, getBloqueCap, createReserva, reservarConCupo, getReservaById, deleteReserva };
