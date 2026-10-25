// Fecha "de hoy" en la zona horaria del gimnasio (America/Santiago), independiente de la zona del servidor.

const TZ = 'America/Santiago';

// Fragmento SQL (tipo date) para usar dentro de consultas; única definición del proyecto.
const HOY_CL_SQL = `(NOW() AT TIME ZONE '${TZ}')::date`;

// Fecha de hoy en Santiago como 'YYYY-MM-DD' (para pasar como parámetro en INSERT/UPDATE).
function hoyChile() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

module.exports = { TZ, HOY_CL_SQL, hoyChile };
