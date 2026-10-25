// Aplica en orden los .sql de src/db/migrations que no esten en schema_migrations.
// Solo para BD local: aborta siempre si el host de DATABASE_URL no es localhost.
// Uso: npm run migrate:local
const fs = require('fs');
const path = require('path');
const { getDbHost, isLocalHost } = require('../config/dbHost');
const guardLocal = require('../config/guardLocal');

guardLocal();
// guardLocal se salta con NODE_ENV=production; este script nunca debe tocar una BD remota.
const host = getDbHost();
if (!host || !isLocalHost(host)) {
  console.error('[migrate] Abortado: DATABASE_URL no apunta a localhost. Las migraciones de produccion se ejecutan a mano.');
  process.exit(1);
}

const { pool } = require('../config/db');

const DIR = path.join(__dirname, 'migrations');

async function main() {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
       nombre      VARCHAR(255) PRIMARY KEY,
       aplicado_en TIMESTAMP    NOT NULL DEFAULT NOW()
     )`
  );
  const aplicadas = new Set((await pool.query('SELECT nombre FROM schema_migrations')).rows.map((r) => r.nombre));
  const archivos = fs.readdirSync(DIR).filter((f) => /\.sql$/.test(f)).sort();

  let n = 0;
  for (const archivo of archivos) {
    if (aplicadas.has(archivo)) { console.log('[migrate] ya aplicada: ' + archivo); continue; }
    const sql = fs.readFileSync(path.join(DIR, archivo), 'utf8');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (nombre) VALUES ($1)', [archivo]);
      await client.query('COMMIT');
      console.log('[migrate] aplicada: ' + archivo);
      n++;
    } catch (err) {
      try { await client.query('ROLLBACK'); } catch (_) { /* conexion caida */ }
      console.error('[migrate] ERROR en ' + archivo + ': ' + err.message);
      client.release();
      throw err;
    }
    client.release();
  }
  console.log('[migrate] listo (' + n + ' nueva(s))');
}

main()
  .then(() => pool.end())
  .catch(() => { pool.end().then(() => process.exit(1)); });
