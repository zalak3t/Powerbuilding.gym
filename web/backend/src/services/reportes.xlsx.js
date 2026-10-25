const ExcelJS = require('exceljs');
const { TZ } = require('../utils/fechas');

const FMT_FECHA = 'dd-mm-yyyy';
const FMT_CLP = '"$"#,##0';
const FMT_PCT = '0.0%';
const CAB = {
  font: { bold: true, color: { argb: 'FFFFFFFF' } },
  fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF222222' } },
  alignment: { vertical: 'middle' },
};
const TOTAL_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE9A8' } };

// 'YYYY-MM-DD' -> Date en UTC medianoche (Excel la muestra sin desfase de zona).
function aFecha(iso) { return new Date(iso + 'T00:00:00Z'); }

function nuevoLibro() {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Powerbuilding.gym';
  wb.created = new Date();
  return wb;
}

function estilarCabecera(row) {
  row.eachCell((c) => { c.font = CAB.font; c.fill = CAB.fill; c.alignment = CAB.alignment; });
  row.height = 20;
}

function estilarTotal(row, desdeCol, hastaCol) {
  for (let c = desdeCol; c <= hastaCol; c++) {
    const cell = row.getCell(c);
    cell.font = { bold: true };
    cell.fill = TOTAL_FILL;
  }
}

// Título y rango en las primeras filas de una hoja de resumen. Devuelve la siguiente fila libre.
function encabezadoResumen(ws, titulo, desde, hasta) {
  ws.getCell('A1').value = 'Powerbuilding.gym - ' + titulo;
  ws.getCell('A1').font = { bold: true, size: 14 };
  ws.getCell('A2').value = 'Período';
  ws.getCell('B2').value = aFecha(desde);
  ws.getCell('C2').value = aFecha(hasta);
  ws.getCell('B2').numFmt = FMT_FECHA;
  ws.getCell('C2').numFmt = FMT_FECHA;
  ws.getCell('A3').value = 'Generado (Santiago)';
  ws.getCell('B3').value = new Intl.DateTimeFormat('es-CL', { timeZone: TZ, dateStyle: 'short', timeStyle: 'short', hour12: false }).format(new Date());
  ws.getCell('A2').font = { bold: true };
  ws.getCell('A3').font = { bold: true };
  return 5;
}

// Escribe una tabla simple (encabezados + filas) desde la fila `fila`. Devuelve { primera, ultima } filas de datos.
function escribirTabla(ws, fila, encabezados, filas) {
  estilarCabecera(ws.getRow(fila));
  encabezados.forEach((h, i) => { ws.getRow(fila).getCell(i + 1).value = h; });
  estilarCabecera(ws.getRow(fila));
  filas.forEach((f, i) => {
    const row = ws.getRow(fila + 1 + i);
    f.forEach((val, k) => { row.getCell(k + 1).value = val; });
  });
  return { primera: fila + 1, ultima: fila + filas.length };
}

function ajustarAnchos(ws, minimo) {
  ws.columns.forEach((col) => {
    let max = minimo || 10;
    col.eachCell({ includeEmpty: false }, (cell) => {
      const v = cell.value;
      let len = 0;
      if (v instanceof Date) len = 10;
      else if (v && typeof v === 'object') len = String(v.result != null ? v.result : '').length;
      else if (v != null) len = String(v).length;
      if (len > max) max = len;
    });
    col.width = Math.min(max + 3, 50);
  });
}

async function enviar(wb, res) {
  await wb.xlsx.write(res);
  res.end();
}

// Rango A1 de una columna de datos, p. ej. 'Detalle'!$E$2:$E$20 (si no hay filas, apunta a la fila 2 vacía).
function rango(hoja, col, primera, ultima) {
  const u = Math.max(ultima, primera);
  return "'" + hoja + "'!$" + col + '$' + primera + ':$' + col + '$' + u;
}

// ── R.16 Asistencia ──────────────────────────────────────────
async function xlsxAsistencia(d, res) {
  const wb = nuevoLibro();
  const resumen = wb.addWorksheet('Resumen');
  const det = wb.addWorksheet('Detalle');

  // Detalle
  const dt = escribirTabla(det, 1, ['Fecha', 'Día', 'Horario', 'Disciplina', 'Instructor', 'Alumno'],
    d.detalle.map((r) => [aFecha(r.fecha), r.dia, r.horario, r.disciplina, r.instructor, r.alumno]));
  det.getColumn(1).numFmt = FMT_FECHA;
  det.views = [{ state: 'frozen', ySplit: 1 }];
  det.autoFilter = { from: 'A1', to: 'F1' };
  ajustarAnchos(det, 10);

  // Resumen
  let f = encabezadoResumen(resumen, 'Reporte de asistencia', d.desde, d.hasta);
  resumen.getCell('A' + f).value = 'Total de asistencias';
  resumen.getCell('A' + f).font = { bold: true };
  resumen.getCell('B' + f).value = { formula: 'COUNTA(' + rango('Detalle', 'A', dt.primera, dt.ultima) + ')', result: d.total };
  estilarTotal(resumen.getRow(f), 1, 2);
  f += 2;

  resumen.getCell('A' + f).value = 'Por bloque';
  resumen.getCell('A' + f).font = { bold: true, size: 12 };
  const tb = escribirTabla(resumen, f + 1, ['Día', 'Horario', 'Disciplina', 'Instructor', 'Asistencias'],
    d.porBloque.map((b) => [b.dia, b.horario, b.disciplina, b.instructor, b.asistencias]));
  const totB = resumen.getRow(tb.ultima + 1);
  totB.getCell(1).value = 'Total';
  totB.getCell(5).value = { formula: 'SUM(E' + tb.primera + ':E' + Math.max(tb.ultima, tb.primera) + ')', result: d.total };
  estilarTotal(totB, 1, 5);
  f = tb.ultima + 3;

  resumen.getCell('A' + f).value = 'Por alumno';
  resumen.getCell('A' + f).font = { bold: true, size: 12 };
  const ta = escribirTabla(resumen, f + 1, ['Alumno', 'Asistencias'], d.porAlumno.map((a) => [a.alumno, a.asistencias]));
  const totA = resumen.getRow(ta.ultima + 1);
  totA.getCell(1).value = 'Total';
  totA.getCell(2).value = { formula: 'SUM(B' + ta.primera + ':B' + Math.max(ta.ultima, ta.primera) + ')', result: d.total };
  estilarTotal(totA, 1, 2);
  ajustarAnchos(resumen, 12);
  resumen.getColumn(1).width = Math.max(resumen.getColumn(1).width, 24);

  await enviar(wb, res);
}

// ── R.17 Ocupación e ingresos ────────────────────────────────
async function xlsxOcupacionIngresos(d, res) {
  const wb = nuevoLibro();
  const resumen = wb.addWorksheet('Resumen');
  const det = wb.addWorksheet('Detalle');
  const o = d.ocupacion;
  const g = d.ingresos;

  // Detalle de pagos
  const dp = escribirTabla(det, 1, ['Fecha', 'Cliente', 'Plan', 'Método', 'Monto'],
    g.detalle.map((r) => [aFecha(r.fecha_pago), r.cliente, r.plan, r.metodo, r.monto]));
  det.getColumn(1).numFmt = FMT_FECHA;
  det.getColumn(5).numFmt = FMT_CLP;
  det.views = [{ state: 'frozen', ySplit: 1 }];
  det.autoFilter = { from: 'A1', to: 'E1' };
  ajustarAnchos(det, 10);

  const colPlan = rango('Detalle', 'C', dp.primera, dp.ultima);
  const colMetodo = rango('Detalle', 'D', dp.primera, dp.ultima);
  const colMonto = rango('Detalle', 'E', dp.primera, dp.ultima);

  // Resumen
  let f = encabezadoResumen(resumen, 'Reporte de ocupación e ingresos', d.desde, d.hasta);
  resumen.getCell('A' + f).value = 'Ingresos del período';
  resumen.getCell('B' + f).value = { formula: 'SUM(' + colMonto + ')', result: g.total };
  resumen.getCell('B' + f).numFmt = FMT_CLP;
  resumen.getCell('A' + (f + 1)).value = 'Número de pagos (no anulados)';
  resumen.getCell('B' + (f + 1)).value = { formula: 'COUNT(' + colMonto + ')', result: g.numeroPagos };
  estilarTotal(resumen.getRow(f), 1, 2);
  estilarTotal(resumen.getRow(f + 1), 1, 2);
  f += 3;

  const tablaIngresos = (titulo, etiqueta, datos, colCrit) => {
    resumen.getCell('A' + f).value = titulo;
    resumen.getCell('A' + f).font = { bold: true, size: 12 };
    const t = escribirTabla(resumen, f + 1, [etiqueta, 'Pagos', 'Monto'], datos.map((r) => [r.nombre, r.pagos, r.monto]));
    for (let r = t.primera; r <= t.ultima; r++) {
      const i = r - t.primera;
      resumen.getCell('B' + r).value = { formula: 'COUNTIF(' + colCrit + ',A' + r + ')', result: datos[i].pagos };
      resumen.getCell('C' + r).value = { formula: 'SUMIF(' + colCrit + ',A' + r + ',' + colMonto + ')', result: datos[i].monto };
      resumen.getCell('C' + r).numFmt = FMT_CLP;
    }
    const tot = resumen.getRow(t.ultima + 1);
    const hasta = Math.max(t.ultima, t.primera);
    tot.getCell(1).value = 'Total';
    tot.getCell(2).value = { formula: 'SUM(B' + t.primera + ':B' + hasta + ')', result: g.numeroPagos };
    tot.getCell(3).value = { formula: 'SUM(C' + t.primera + ':C' + hasta + ')', result: g.total };
    tot.getCell(3).numFmt = FMT_CLP;
    estilarTotal(tot, 1, 3);
    f = t.ultima + 3;
  };
  tablaIngresos('Ingresos por plan', 'Plan', g.porPlan, colPlan);
  tablaIngresos('Ingresos por método', 'Método', g.porMetodo, colMetodo);

  resumen.getCell('A' + f).value = 'Ocupación por bloque';
  resumen.getCell('A' + f).font = { bold: true, size: 12 };
  const tb = escribirTabla(resumen, f + 1,
    ['Día', 'Horario', 'Disciplina', 'Instructor', 'Estado', 'Capacidad', 'Inscritos', '% inscripción', 'Sesiones', 'Asistencias', '% asistencia'],
    o.bloques.map((b) => [b.dia, b.horario, b.disciplina, b.instructor, b.estado, b.capacidad, b.inscritos, null, b.sesiones, b.asistencias, null]));
  for (let r = tb.primera; r <= tb.ultima; r++) {
    const b = o.bloques[r - tb.primera];
    resumen.getCell('H' + r).value = { formula: 'IF(F' + r + '=0,0,G' + r + '/F' + r + ')', result: b.pct_inscripcion / 100 };
    resumen.getCell('K' + r).value = { formula: 'IF(I' + r + '*F' + r + '=0,0,J' + r + '/(I' + r + '*F' + r + '))', result: b.pct_asistencia / 100 };
    resumen.getCell('H' + r).numFmt = FMT_PCT;
    resumen.getCell('K' + r).numFmt = FMT_PCT;
  }
  const u = Math.max(tb.ultima, tb.primera);
  const tot = resumen.getRow(tb.ultima + 1);
  tot.getCell(1).value = 'Total';
  tot.getCell(6).value = { formula: 'SUM(F' + tb.primera + ':F' + u + ')', result: o.totales.capacidad };
  tot.getCell(7).value = { formula: 'SUM(G' + tb.primera + ':G' + u + ')', result: o.totales.inscritos };
  tot.getCell(10).value = { formula: 'SUM(J' + tb.primera + ':J' + u + ')', result: o.totales.asistencias };
  estilarTotal(tot, 1, 11);
  const nota = resumen.getRow(tot.number + 2);
  nota.getCell(1).value = 'Inscritos = reservas vigentes hoy. % asistencia = asistencias / (sesiones del período x capacidad).';
  nota.getCell(1).font = { italic: true, color: { argb: 'FF666666' } };

  ajustarAnchos(resumen, 12);
  resumen.getColumn(1).width = Math.max(resumen.getColumn(1).width, 30);
  await enviar(wb, res);
}

module.exports = { xlsxAsistencia, xlsxOcupacionIngresos };
