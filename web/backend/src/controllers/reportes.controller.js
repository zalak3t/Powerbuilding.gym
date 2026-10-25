const { datosAsistencia, datosOcupacionIngresos } = require('../services/reportes.service');
const { hoyChile } = require('../utils/fechas');
const v = require('../utils/validate');

const MAX_DIAS = 366; // rango máximo inclusivo

const FORMATOS = {
  json: null,
  pdf:  { mime: 'application/pdf', ext: 'pdf' },
  xlsx: { mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', ext: 'xlsx' },
};

// Generadores de archivos por reporte y formato: se registran en 4.3 (pdf) y 4.4 (xlsx).
const EXPORTADORES = {
  asistencia:           { pdf: null, xlsx: null },
  'ocupacion-ingresos': { pdf: null, xlsx: null },
};

// Mes actual completo (día 1 al último día) en America/Santiago.
function rangoMesActual() {
  const hoy = hoyChile();
  const y = parseInt(hoy.slice(0, 4), 10);
  const m = parseInt(hoy.slice(5, 7), 10);
  const ultimo = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const mm = hoy.slice(5, 7);
  return { desde: y + '-' + mm + '-01', hasta: y + '-' + mm + '-' + String(ultimo).padStart(2, '0') };
}

function diasInclusivos(desde, hasta) {
  return Math.round((new Date(hasta + 'T00:00:00Z') - new Date(desde + 'T00:00:00Z')) / 86400000) + 1;
}

// Devuelve { error } o { desde, hasta, formato }.
function validarQuery(q) {
  const def = rangoMesActual();
  const vacio = (x) => x === undefined || x === null || x === '';
  const desde = vacio(q.desde) ? def.desde : v.parseFechaISO(q.desde);
  if (!desde) return { error: 'desde debe tener formato AAAA-MM-DD' };
  const hasta = vacio(q.hasta) ? def.hasta : v.parseFechaISO(q.hasta);
  if (!hasta) return { error: 'hasta debe tener formato AAAA-MM-DD' };
  if (desde > hasta) return { error: 'desde no puede ser posterior a hasta' };
  if (diasInclusivos(desde, hasta) > MAX_DIAS) return { error: 'El rango no puede superar ' + MAX_DIAS + ' días' };
  const formato = vacio(q.formato) ? 'json' : q.formato;
  if (typeof formato !== 'string' || !Object.prototype.hasOwnProperty.call(FORMATOS, formato)) {
    return { error: 'formato debe ser: json, pdf o xlsx' };
  }
  return { desde, hasta, formato };
}

function crearHandler(clave, obtenerDatos) {
  return async function (req, res) {
    const val = validarQuery(req.query || {});
    if (val.error) return res.status(400).json({ ok: false, error: val.error });

    const datos = await obtenerDatos(val.desde, val.hasta);
    if (val.formato === 'json') return res.json({ ok: true, reporte: datos });

    const gen = EXPORTADORES[clave][val.formato];
    if (!gen) return res.status(501).json({ ok: false, error: 'Formato no disponible aún' });
    const f = FORMATOS[val.formato];
    // El nombre solo contiene la clave fija y fechas ya validadas (AAAA-MM-DD).
    const nombre = 'reporte-' + clave + '_' + val.desde + '_' + val.hasta + '.' + f.ext;
    res.setHeader('Content-Type', f.mime);
    res.setHeader('Content-Disposition', 'attachment; filename="' + nombre + '"');
    res.setHeader('Cache-Control', 'no-store');
    return gen(datos, res);
  };
}

const reporteAsistencia = crearHandler('asistencia', datosAsistencia);
const reporteOcupacionIngresos = crearHandler('ocupacion-ingresos', datosOcupacionIngresos);

module.exports = { reporteAsistencia, reporteOcupacionIngresos, EXPORTADORES };
