// Utilidades para inspeccionar el host de DATABASE_URL sin exponer la URL ni sus credenciales.
const LOCAL_HOSTS = ['localhost', '127.0.0.1', '::1'];

/** Devuelve el host de DATABASE_URL o null si falta o no se puede interpretar. */
function getDbHost() {
  try {
    return new URL(process.env.DATABASE_URL).hostname.replace(/^\[|\]$/g, '').toLowerCase();
  } catch (e) {
    return null;
  }
}

function isLocalHost(host) {
  return LOCAL_HOSTS.includes(host);
}

module.exports = { getDbHost, isLocalHost };
