const { query } = require('../config/db');

async function dbTest(req, res) {
  if (!process.env.DATABASE_URL) {
    return res.status(503).json({
      ok: false,
      database: 'not_configured',
      error: 'DATABASE_URL no está configurado en las variables de entorno',
    });
  }

  try {
    const result = await query('SELECT NOW() AS now');
    res.json({
      ok: true,
      database: 'connected',
      now: result.rows[0].now,
    });
  } catch (err) {
    console.error('[db-test] Error al conectar con la base de datos:', err.message);
    res.status(500).json({
      ok: false,
      database: 'error',
      error: 'No se pudo conectar con la base de datos',
    });
  }
}

module.exports = { dbTest };
