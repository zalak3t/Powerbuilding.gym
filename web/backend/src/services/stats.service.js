const { query } = require('../config/db');
const { HOY_CL_SQL } = require('../utils/fechas');

const DIAS_ES = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
function diaHoyEs() {
  const nowChile = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Santiago' }));
  return DIAS_ES[nowChile.getDay()];
}

const ORDER_DIA = `ARRAY_POSITION(ARRAY['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'], dia)`;

// ── Funciones atómicas ────────────────────────────────────────────────────────

async function getResumenClientes() {
  const r = await query(`
    SELECT
      COUNT(*)::int                                             AS total_clientes,
      COUNT(*) FILTER (WHERE estado='activo')::int             AS clientes_activos,
      COUNT(*) FILTER (WHERE estado IN ('bloqueado','suspendido'))::int AS clientes_bloqueados
    FROM clientes
  `);
  return r.rows[0];
}

async function getResumenBloques() {
  const r = await query(`
    SELECT
      COUNT(*)::int                                        AS total_bloques,
      COUNT(*) FILTER (WHERE estado='activo')::int         AS bloques_activos,
      COUNT(*) FILTER (WHERE estado='suspendido')::int     AS bloques_suspendidos
    FROM bloques
  `);
  return r.rows[0];
}

async function getResumenReservasAsistencias() {
  const dia = diaHoyEs();
  const r = await query(`
    SELECT
      COUNT(DISTINCT rv.id)::int                             AS reservas_totales,
      COUNT(DISTINCT a.id)::int                              AS asistencias_hoy,
      COUNT(DISTINCT rv.id) FILTER (WHERE b.dia = $1)::int  AS reservas_hoy
    FROM reservas rv
    JOIN bloques b ON b.id = rv.bloque_id
    LEFT JOIN asistencias a ON a.reserva_id = rv.id AND a.fecha = ${HOY_CL_SQL}
  `, [dia]);
  return r.rows[0];
}

async function getOcupacionGlobal() {
  const r = await query(`
    SELECT COALESCE(
      ROUND(AVG(COALESCE(ins.inscritos,0)::float / NULLIF(b.capacidad,0) * 100))::int,
      0
    ) AS ocupacion_global
    FROM bloques b
    LEFT JOIN (
      SELECT bloque_id, COUNT(*)::int AS inscritos FROM reservas GROUP BY bloque_id
    ) ins ON ins.bloque_id = b.id
  `);
  return r.rows[0].ocupacion_global;
}

async function getOcupacionPorDia() {
  const r = await query(`
    SELECT b.dia, COUNT(rv.id)::int AS reservas
    FROM bloques b
    LEFT JOIN reservas rv ON rv.bloque_id = b.id
    GROUP BY b.dia
    ORDER BY ${ORDER_DIA}
  `);
  return r.rows;
}

async function getOcupacionPorBloque() {
  const r = await query(`
    SELECT
      b.dia || ' ' || b.horario                                    AS label,
      COALESCE(COUNT(rv.id)::int, 0)                               AS inscritos,
      b.capacidad,
      COALESCE(ROUND(COUNT(rv.id)::float / NULLIF(b.capacidad,0) * 100)::int, 0) AS pct
    FROM bloques b
    LEFT JOIN reservas rv ON rv.bloque_id = b.id
    GROUP BY b.id
    ORDER BY pct DESC, ${ORDER_DIA}
    LIMIT 12
  `);
  return r.rows;
}

async function getActividadReciente() {
  const r = await query(`
    SELECT
      c.nombre     AS cliente,
      b.dia,
      b.horario,
      (a.id IS NOT NULL) AS asistio
    FROM reservas rv
    JOIN clientes   c ON c.id = rv.cliente_id
    JOIN bloques    b ON b.id = rv.bloque_id
    LEFT JOIN asistencias a ON a.reserva_id = rv.id AND a.fecha = ${HOY_CL_SQL}
    ORDER BY rv.creado_en DESC
    LIMIT 6
  `);
  return r.rows;
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

async function getDashboardStats() {
  const [clientes, bloques, reservasAtt, ocGlobal, ocDia, ocBloque, actividad] = await Promise.all([
    getResumenClientes(),
    getResumenBloques(),
    getResumenReservasAsistencias(),
    getOcupacionGlobal(),
    getOcupacionPorDia(),
    getOcupacionPorBloque(),
    getActividadReciente(),
  ]);

  const { reservas_hoy, asistencias_hoy, reservas_totales } = reservasAtt;
  const tasa_asistencia_hoy = reservas_hoy > 0
    ? Math.round(asistencias_hoy / reservas_hoy * 100)
    : 0;

  // Alertas generadas desde condiciones reales
  const alertas = [];
  if (bloques.bloques_suspendidos > 0) {
    alertas.push({ tipo: 'warning', mensaje: `Hay ${bloques.bloques_suspendidos} bloque(s) suspendido(s)` });
  }
  if (clientes.clientes_bloqueados > 0) {
    alertas.push({ tipo: 'info', mensaje: `${clientes.clientes_bloqueados} cliente(s) bloqueado(s) o suspendido(s)` });
  }
  if (tasa_asistencia_hoy < 50 && reservas_hoy > 0) {
    alertas.push({ tipo: 'warning', mensaje: `Tasa de asistencia hoy por debajo del 50%` });
  }

  return {
    ...clientes,
    ...bloques,
    reservas_totales,
    asistencias_hoy,
    reservas_hoy,
    tasa_asistencia_hoy,
    ocupacion_global: ocGlobal,
    ocupacion_por_dia:    ocDia,
    ocupacion_por_bloque: ocBloque,
    actividad_reciente:   actividad,
    alertas,
  };
}

// ── Negocio ───────────────────────────────────────────────────────────────────

async function getTasaAsistenciaGeneral() {
  const r = await query(`
    SELECT
      COUNT(DISTINCT rv.id)::int  AS total_reservas,
      COUNT(DISTINCT a.id)::int   AS total_asistencias
    FROM reservas rv
    LEFT JOIN asistencias a ON a.reserva_id = rv.id
  `);
  const { total_reservas, total_asistencias } = r.rows[0];
  return {
    tasa_asistencia: total_reservas > 0
      ? Math.round(total_asistencias / total_reservas * 100)
      : 0,
    total_reservas,
    total_asistencias,
  };
}

async function getReservasPromedioPorCliente() {
  const r = await query(`
    SELECT COALESCE(ROUND(AVG(cnt)::numeric, 1)::float, 0) AS promedio
    FROM (SELECT COUNT(*) AS cnt FROM reservas GROUP BY cliente_id) t
  `);
  return r.rows[0].promedio;
}

async function getTendencia() {
  // Reservas creadas agrupadas por semana ISO (últimas 8 semanas)
  const r = await query(`
    SELECT
      DATE_TRUNC('week', creado_en)::date AS semana,
      COUNT(*)::int                        AS valor
    FROM reservas
    WHERE creado_en >= NOW() - INTERVAL '8 weeks'
    GROUP BY semana
    ORDER BY semana
  `);
  // Etiquetar como "Semana 1", "Semana 2", ... desde la más antigua
  return r.rows.map((row, i) => ({
    label: `Semana ${i + 1}`,
    semana: row.semana,
    valor:  row.valor,
  }));
}

async function getClientesRiesgo() {
  // Clientes activos sin visita reciente (más de 14 días) o con ultima_visita NULL
  const r = await query(`
    SELECT
      c.id,
      c.nombre,
      c.telefono,
      c.ultima_visita,
      CASE
        WHEN c.ultima_visita IS NULL THEN 999
        ELSE (${HOY_CL_SQL} - c.ultima_visita)::int
      END                           AS dias_sin_visita,
      COUNT(rv.id)::int             AS reservas
    FROM clientes c
    LEFT JOIN reservas rv ON rv.cliente_id = c.id
    WHERE c.estado = 'activo'
      AND (c.ultima_visita IS NULL OR ${HOY_CL_SQL} - c.ultima_visita > 14)
    GROUP BY c.id
    ORDER BY dias_sin_visita DESC
    LIMIT 5
  `);
  return r.rows;
}

async function getNegocioStats() {
  const [tasaObj, clientes, reservasPromedio, ocBloque, tendencia, riesgo] = await Promise.all([
    getTasaAsistenciaGeneral(),
    getResumenClientes(),
    getReservasPromedioPorCliente(),
    getOcupacionPorBloque(),
    getTendencia(),
    getClientesRiesgo(),
  ]);

  return {
    tasa_asistencia:     tasaObj.tasa_asistencia,
    total_reservas:      tasaObj.total_reservas,
    total_asistencias:   tasaObj.total_asistencias,
    clientes_activos:    clientes.clientes_activos,
    clientes_bloqueados: clientes.clientes_bloqueados,
    reservas_promedio:   reservasPromedio,
    ranking_bloques:     ocBloque,
    retencion: [
      { label: 'Activos',             valor: clientes.clientes_activos },
      { label: 'Bloqueados/Suspendidos', valor: clientes.clientes_bloqueados },
    ],
    tendencia,
    clientes_riesgo: riesgo,
  };
}

module.exports = { getDashboardStats, getNegocioStats };
