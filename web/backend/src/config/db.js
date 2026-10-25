const { Pool } = require('pg');
const { getDbHost, isLocalHost } = require('./dbHost');

if (!process.env.DATABASE_URL) {
  console.warn('[db] DATABASE_URL no configurado — la base de datos no estará disponible');
}

// SSL: se desactiva solo si la BD está en localhost; si no se puede leer el host,
// se mantiene el criterio anterior (SSL únicamente con NODE_ENV=production).
const dbHost = getDbHost();
const useSsl = dbHost ? !isLocalHost(dbHost) : process.env.NODE_ENV === 'production';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: useSsl ? { rejectUnauthorized: false } : false,
});

pool.on('error', (err) => {
  console.error('[db] Error inesperado en el pool de conexiones:', err.message);
});

/**
 * Ejecuta una consulta parametrizada contra PostgreSQL.
 * @param {string} text  - Consulta SQL con placeholders $1, $2, ...
 * @param {Array}  params - Valores para los placeholders
 */
async function query(text, params) {
  const result = await pool.query(text, params);
  return result;
}

module.exports = { pool, query };
