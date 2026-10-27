const { query } = require('../config/db');
const v = require('../utils/validate');
const { hoyChile } = require('../utils/fechas');

const EJERCICIOS = ['sentadilla', 'banca', 'peso_muerto'];
// Rango razonable de kg declarados por ejercicio (mínimo, máximo).
const LIMITES_KG = { sentadilla: [20, 600], banca: [20, 500], peso_muerto: [20, 600] };
const MAX_MARCAS_POR_CLIENTE = 500;

// Devuelve { error } o { ejercicio, kg, fecha } normalizados.
function validarMarca(body) {
  const { ejercicio, kg, fecha } = body || {};
  if (!v.isOneOf(ejercicio, EJERCICIOS)) return { error: 'ejercicio debe ser sentadilla, banca o peso_muerto' };

  let n;
  if (typeof kg === 'number') n = kg;
  else if (typeof kg === 'string' && /^\d{1,3}(\.\d)?$/.test(kg.trim())) n = parseFloat(kg);
  else return { error: 'kg debe ser un número' };
  if (!Number.isFinite(n) || Math.round(n * 2) !== n * 2) return { error: 'kg debe ser múltiplo de 0,5' };
  const [min, max] = LIMITES_KG[ejercicio];
  if (n < min || n > max) return { error: 'kg fuera de rango para ' + ejercicio + ' (' + min + ' a ' + max + ' kg)' };

  const f = v.parseFechaISO(fecha);
  if (!f) return { error: 'fecha inválida (usa AAAA-MM-DD)' };
  const hoy = hoyChile();
  if (f > hoy) return { error: 'La fecha no puede ser futura' };
  const minima = (parseInt(hoy.slice(0, 4), 10) - 10) + hoy.slice(4);
  if (f < minima) return { error: 'La fecha no puede ser anterior a 10 años' };

  return { ejercicio, kg: n, fecha: f };
}

async function listarMarcas(clienteId) {
  const r = await query(
    `SELECT id, ejercicio, kg::float8 AS kg, to_char(fecha, 'YYYY-MM-DD') AS fecha
     FROM marcas WHERE cliente_id = $1 ORDER BY fecha ASC, id ASC`,
    [clienteId]
  );
  return r.rows;
}

// Mejor por ejercicio (mayor kg; empate -> la más reciente), total (suma de las tres mejores, solo si
// existen las tres), ejercicios que faltan y progreso (mejor acumulado por fecha). `filas` va en orden cronológico.
function resumirMarcas(filas) {
  const mejores = { sentadilla: null, banca: null, peso_muerto: null };
  for (const m of filas) {
    const a = mejores[m.ejercicio];
    if (!a || m.kg > a.kg || (m.kg === a.kg && m.fecha >= a.fecha)) mejores[m.ejercicio] = { id: m.id, kg: m.kg, fecha: m.fecha };
  }
  const faltan = EJERCICIOS.filter((e) => !mejores[e]);
  const total = faltan.length ? null : mejores.sentadilla.kg + mejores.banca.kg + mejores.peso_muerto.kg;

  const progreso = [];
  const run = { sentadilla: null, banca: null, peso_muerto: null };
  for (let i = 0; i < filas.length; i++) {
    const m = filas[i];
    if (run[m.ejercicio] === null || m.kg > run[m.ejercicio]) run[m.ejercicio] = m.kg;
    const ultimoDelDia = i === filas.length - 1 || filas[i + 1].fecha !== m.fecha;
    if (ultimoDelDia) {
      const completo = EJERCICIOS.every((e) => run[e] !== null);
      progreso.push({
        fecha: m.fecha,
        sentadilla: run.sentadilla, banca: run.banca, peso_muerto: run.peso_muerto,
        total: completo ? run.sentadilla + run.banca + run.peso_muerto : null,
      });
    }
  }
  return { mejores, total: total === null ? null : Math.round(total * 10) / 10, faltan, progreso };
}

async function marcasDeCliente(clienteId) {
  const historial = await listarMarcas(clienteId);
  return { ...resumirMarcas(historial), historial: historial.slice().reverse() };
}

// Devuelve { marca } o { error: 'LIMITE' }.
async function crearMarca(clienteId, { ejercicio, kg, fecha }) {
  const c = await query('SELECT COUNT(*)::int AS n FROM marcas WHERE cliente_id = $1', [clienteId]);
  if (c.rows[0].n >= MAX_MARCAS_POR_CLIENTE) return { error: 'LIMITE' };
  const r = await query(
    `INSERT INTO marcas (cliente_id, ejercicio, kg, fecha) VALUES ($1, $2, $3, $4::date)
     RETURNING id, ejercicio, kg::float8 AS kg, to_char(fecha, 'YYYY-MM-DD') AS fecha`,
    [clienteId, ejercicio, kg, fecha]
  );
  return { marca: r.rows[0] };
}

// Solo borra si la marca pertenece al cliente indicado.
async function borrarMarca(clienteId, id) {
  const r = await query('DELETE FROM marcas WHERE id = $1 AND cliente_id = $2 RETURNING id', [id, clienteId]);
  return r.rowCount > 0;
}

module.exports = {
  EJERCICIOS, MAX_MARCAS_POR_CLIENTE,
  validarMarca, marcasDeCliente, crearMarca, borrarMarca, resumirMarcas,
};
