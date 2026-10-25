const { query } = require('../config/db');
const { DIAS } = require('../utils/validate');

const SIN_ASIGNAR = 'Sin asignar';

// Orden de la semana para ordenar bloques (Lunes primero).
function ordenDia(dia) {
  return DIAS.indexOf(dia);
}

// Cuántas veces cae cada día de la semana dentro de [desde, hasta] (inclusivo). Devuelve { Lunes: n, ... }.
function contarDiasSemana(desde, hasta) {
  // getUTCDay: 0 = domingo ... 6 = sábado
  const porIndiceJs = [0, 0, 0, 0, 0, 0, 0];
  const fin = new Date(hasta + 'T00:00:00Z').getTime();
  for (let t = new Date(desde + 'T00:00:00Z').getTime(); t <= fin; t += 86400000) {
    porIndiceJs[new Date(t).getUTCDay()]++;
  }
  return {
    Lunes: porIndiceJs[1], Martes: porIndiceJs[2], 'Miércoles': porIndiceJs[3], Jueves: porIndiceJs[4],
    Viernes: porIndiceJs[5], 'Sábado': porIndiceJs[6], Domingo: porIndiceJs[0],
  };
}

function contarPor(filas, claveFn) {
  const mapa = new Map();
  filas.forEach((f) => {
    const k = claveFn(f);
    mapa.set(k, (mapa.get(k) || 0) + 1);
  });
  return mapa;
}

/**
 * R.16 — Asistencia en [desde, hasta] (fecha de la asistencia, inclusivo).
 * Devuelve { desde, hasta, detalle, porAlumno, porBloque, total }.
 */
async function datosAsistencia(desde, hasta) {
  const res = await query(
    `SELECT to_char(a.fecha, 'YYYY-MM-DD') AS fecha,
            b.id AS bloque_id, b.dia, b.horario,
            COALESCE(d.nombre, $3) AS disciplina,
            COALESCE(i.nombre, $3) AS instructor,
            c.id AS cliente_id, c.nombre AS alumno
     FROM asistencias a
     JOIN reservas r  ON r.id = a.reserva_id
     JOIN bloques b   ON b.id = r.bloque_id
     JOIN clientes c  ON c.id = r.cliente_id
     LEFT JOIN disciplinas d  ON d.id = b.disciplina_id
     LEFT JOIN instructores i ON i.id = b.instructor_id
     WHERE a.fecha >= $1::date AND a.fecha <= $2::date
     ORDER BY a.fecha, b.horario, c.nombre, a.id`,
    [desde, hasta, SIN_ASIGNAR]
  );
  const detalle = res.rows;

  const porAlumno = Array.from(contarPor(detalle, (f) => f.cliente_id + '|' + f.alumno))
    .map(([k, n]) => ({ alumno: k.slice(k.indexOf('|') + 1), asistencias: n }))
    .sort((x, y) => y.asistencias - x.asistencias || x.alumno.localeCompare(y.alumno, 'es'));

  const bloquesInfo = new Map();
  detalle.forEach((f) => bloquesInfo.set(f.bloque_id, f));
  const porBloque = Array.from(contarPor(detalle, (f) => f.bloque_id))
    .map(([id, n]) => {
      const b = bloquesInfo.get(id);
      return { bloque_id: id, dia: b.dia, horario: b.horario, disciplina: b.disciplina, instructor: b.instructor, asistencias: n };
    })
    .sort((x, y) => ordenDia(x.dia) - ordenDia(y.dia) || x.horario.localeCompare(y.horario));

  return { desde, hasta, detalle, porAlumno, porBloque, total: detalle.length };
}

/**
 * R.17 — Ocupación por bloque (inscritos actuales, asistencias del rango) e ingresos
 * (pagos no anulados por fecha_pago). Devuelve { desde, hasta, ocupacion, ingresos }.
 */
async function datosOcupacionIngresos(desde, hasta) {
  const bl = await query(
    `SELECT b.id AS bloque_id, b.dia, b.horario, b.estado, b.capacidad,
            COALESCE(d.nombre, $3) AS disciplina,
            COALESCE(i.nombre, $3) AS instructor,
            (SELECT COUNT(*)::int FROM reservas r WHERE r.bloque_id = b.id) AS inscritos,
            (SELECT COUNT(*)::int FROM asistencias a
               JOIN reservas r ON r.id = a.reserva_id
              WHERE r.bloque_id = b.id AND a.fecha >= $1::date AND a.fecha <= $2::date) AS asistencias
     FROM bloques b
     LEFT JOIN disciplinas d  ON d.id = b.disciplina_id
     LEFT JOIN instructores i ON i.id = b.instructor_id`,
    [desde, hasta, SIN_ASIGNAR]
  );
  const sesionesPorDia = contarDiasSemana(desde, hasta);
  const bloques = bl.rows.map((b) => {
    const sesiones = sesionesPorDia[b.dia] || 0;
    const cupos = sesiones * b.capacidad;
    return {
      bloque_id: b.bloque_id, dia: b.dia, horario: b.horario, estado: b.estado,
      disciplina: b.disciplina, instructor: b.instructor,
      capacidad: b.capacidad, inscritos: b.inscritos,
      pct_inscripcion: Math.round((b.inscritos / b.capacidad) * 1000) / 10,
      sesiones, asistencias: b.asistencias,
      pct_asistencia: cupos > 0 ? Math.round((b.asistencias / cupos) * 1000) / 10 : 0,
    };
  }).sort((x, y) => ordenDia(x.dia) - ordenDia(y.dia) || x.horario.localeCompare(y.horario));

  const pg = await query(
    `SELECT pg.id, to_char(pg.fecha_pago, 'YYYY-MM-DD') AS fecha_pago,
            c.nombre AS cliente, pl.nombre AS plan, pg.metodo, pg.monto
     FROM pagos pg
     JOIN clientes c ON c.id = pg.cliente_id
     JOIN planes pl  ON pl.id = pg.plan_id
     WHERE pg.estado <> 'anulado'
       AND pg.fecha_pago >= $1::date AND pg.fecha_pago <= $2::date
     ORDER BY pg.fecha_pago, pg.id`,
    [desde, hasta]
  );
  const detalle = pg.rows;
  const sumarPor = (claveFn) => {
    const m = new Map();
    detalle.forEach((p) => {
      const k = claveFn(p);
      const cur = m.get(k) || { pagos: 0, monto: 0 };
      cur.pagos++; cur.monto += p.monto;
      m.set(k, cur);
    });
    return Array.from(m, ([nombre, v]) => ({ nombre, pagos: v.pagos, monto: v.monto }))
      .sort((x, y) => y.monto - x.monto || x.nombre.localeCompare(y.nombre, 'es'));
  };

  return {
    desde, hasta,
    ocupacion: {
      bloques,
      totales: {
        capacidad: bloques.reduce((s, b) => s + b.capacidad, 0),
        inscritos: bloques.reduce((s, b) => s + b.inscritos, 0),
        asistencias: bloques.reduce((s, b) => s + b.asistencias, 0),
      },
    },
    ingresos: {
      total: detalle.reduce((s, p) => s + p.monto, 0),
      numeroPagos: detalle.length,
      porPlan: sumarPor((p) => p.plan),
      porMetodo: sumarPor((p) => p.metodo),
      detalle,
    },
  };
}

module.exports = { datosAsistencia, datosOcupacionIngresos, contarDiasSemana };
