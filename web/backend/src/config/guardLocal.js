const { getDbHost, isLocalHost } = require('./dbHost');

/**
 * Fuera de produccion, el servidor solo arranca si DATABASE_URL apunta a localhost.
 * Evita usar por accidente la base de produccion desde un entorno de desarrollo.
 * Nunca imprime la URL ni sus credenciales.
 */
function guardLocal() {
  if (process.env.NODE_ENV === 'production') return;

  const host = getDbHost();
  if (host && isLocalHost(host)) return;

  const motivo = host
    ? 'DATABASE_URL apunta a un host que no es localhost/127.0.0.1'
    : 'DATABASE_URL falta o no es valida';
  console.error('[guard] Arranque abortado: ' + motivo + ' y NODE_ENV no es "production".');
  console.error('[guard] En desarrollo usa `npm run dev:local` con web/backend/.env.dev apuntando a la base local.');
  process.exit(1);
}

module.exports = guardLocal;
