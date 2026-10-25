const { pool } = require('../config/db');

// Ejecuta fn(client) dentro de una transacción: COMMIT si termina bien, ROLLBACK si lanza.
async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (_) { /* conexión ya caída */ }
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { withTransaction };
