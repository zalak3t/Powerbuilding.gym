const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  console.warn('[db] DATABASE_URL no configurado — la base de datos no estará disponible');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Railway requiere SSL en producción; en desarrollo local (sin SSL) se desactiva
  ssl: process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: false }
    : false,
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
