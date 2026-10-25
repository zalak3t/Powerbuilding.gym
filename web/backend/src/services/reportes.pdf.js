const PDFDocument = require('pdfkit');
const { TZ } = require('../utils/fechas');

const M = 40;            // margen
const ROW_H = 18;
const COLOR = { texto: '#1a1a1a', tenue: '#666666', cab: '#222222', cabTxt: '#ffffff', zebra: '#f3f3f3', total: '#ffe9a8', linea: '#cccccc' };

function fechaCorta(iso) { return iso.slice(8, 10) + '-' + iso.slice(5, 7) + '-' + iso.slice(0, 4); }
function clp(n) { return '$' + String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
function ahoraSantiago() {
  return new Intl.DateTimeFormat('es-CL', { timeZone: TZ, dateStyle: 'short', timeStyle: 'short', hour12: false }).format(new Date());
}

// Contexto de dibujo: encabezado de página, tablas con encabezado repetido y pie con número de página.
function crearDocumento(titulo, desde, hasta) {
  const doc = new PDFDocument({
    size: 'A4', margins: { top: M + 10, bottom: 50, left: M, right: M }, bufferPages: true,
    info: { Title: titulo + ' - Powerbuilding.gym', Author: 'Powerbuilding.gym' },
  });
  const ancho = doc.page.width - M * 2;
  let tablaActual = null;

  function limite() { return doc.page.height - 50; }

  function cabeceraTabla(t) {
    let x = M;
    const y = doc.y;
    doc.rect(M, y, ancho, ROW_H).fill(COLOR.cab);
    doc.fillColor(COLOR.cabTxt).font('Helvetica-Bold').fontSize(8);
    t.cols.forEach((c) => {
      doc.text(c.h, x + 4, y + 5, { width: c.w - 8, align: c.align || 'left', lineBreak: false, ellipsis: true });
      x += c.w;
    });
    doc.y = y + ROW_H;
  }

  // Páginas posteriores a la primera: marca pequeña y encabezado de la tabla en curso.
  doc.on('pageAdded', () => {
    doc.fillColor(COLOR.tenue).font('Helvetica-Bold').fontSize(8)
      .text('Powerbuilding.gym - ' + titulo + ' (' + fechaCorta(desde) + ' al ' + fechaCorta(hasta) + ')', M, M - 8, { width: ancho, lineBreak: false });
    doc.y = M + 10;
    if (tablaActual) cabeceraTabla(tablaActual);
  });

  const api = {
    doc,
    ancho,
    portada() {
      doc.fillColor(COLOR.texto).font('Helvetica-Bold').fontSize(22).text('Powerbuilding.gym', M, M);
      doc.font('Helvetica-Bold').fontSize(15).text(titulo);
      doc.moveDown(0.3).font('Helvetica').fontSize(10).fillColor(COLOR.tenue)
        .text('Período: ' + fechaCorta(desde) + ' al ' + fechaCorta(hasta))
        .text('Generado: ' + ahoraSantiago() + ' (hora de Santiago)');
      doc.moveTo(M, doc.y + 6).lineTo(M + ancho, doc.y + 6).strokeColor(COLOR.linea).stroke();
      doc.y += 16;
    },
    seccion(texto) {
      tablaActual = null;
      if (doc.y + 60 > limite()) doc.addPage();
      doc.moveDown(0.6).fillColor(COLOR.texto).font('Helvetica-Bold').fontSize(12).text(texto, M, doc.y);
      doc.moveDown(0.3);
    },
    // Recuadro destacado con pares [etiqueta, valor].
    destacados(pares) {
      tablaActual = null;
      const y = doc.y;
      doc.rect(M, y, ancho, 28).fill(COLOR.total);
      const w = ancho / pares.length;
      pares.forEach((p, i) => {
        doc.fillColor(COLOR.tenue).font('Helvetica').fontSize(8).text(p[0], M + i * w + 8, y + 4, { width: w - 12, lineBreak: false });
        doc.fillColor(COLOR.texto).font('Helvetica-Bold').fontSize(12).text(p[1], M + i * w + 8, y + 13, { width: w - 12, lineBreak: false });
      });
      doc.y = y + 36;
    },
    nota(texto) {
      doc.fillColor(COLOR.tenue).font('Helvetica-Oblique').fontSize(7.5).text(texto, M, doc.y, { width: ancho });
    },
    // cols: [{h, w (suma = 515), align}], filas: arrays, totalFila: array opcional que se destaca.
    tabla(cols, filas, totalFila) {
      const t = { cols };
      if (doc.y + ROW_H * 3 > limite()) doc.addPage();
      tablaActual = t;
      cabeceraTabla(t);
      const dibujar = (fila, i, esTotal) => {
        if (doc.y + ROW_H > limite()) doc.addPage(); // pageAdded redibuja el encabezado de la tabla
        const y = doc.y;
        if (esTotal) doc.rect(M, y, ancho, ROW_H).fill(COLOR.total);
        else if (i % 2 === 1) doc.rect(M, y, ancho, ROW_H).fill(COLOR.zebra);
        doc.fillColor(COLOR.texto).font(esTotal ? 'Helvetica-Bold' : 'Helvetica').fontSize(8);
        let x = M;
        cols.forEach((c, k) => {
          doc.text(String(fila[k] == null ? '' : fila[k]), x + 4, y + 5, { width: c.w - 8, align: c.align || 'left', lineBreak: false, ellipsis: true });
          x += c.w;
        });
        doc.y = y + ROW_H;
      };
      if (!filas.length) {
        doc.fillColor(COLOR.tenue).font('Helvetica-Oblique').fontSize(9).text('Sin datos en el período.', M + 4, doc.y + 5, { lineBreak: false });
        doc.y += ROW_H;
      }
      filas.forEach((f, i) => dibujar(f, i, false));
      if (totalFila) dibujar(totalFila, 0, true);
      tablaActual = null;
      doc.y += 6;
    },
    finalizar(res) {
      const rango = doc.bufferedPageRange();
      for (let i = 0; i < rango.count; i++) {
        doc.switchToPage(rango.start + i);
        doc.page.margins.bottom = 0; // evita que el pie genere una página nueva
        doc.fillColor(COLOR.tenue).font('Helvetica').fontSize(8)
          .text('Página ' + (i + 1) + ' de ' + rango.count, M, doc.page.height - 30, { width: ancho, align: 'center', lineBreak: false });
      }
      doc.pipe(res);
      doc.end();
    },
  };
  return api;
}

// ── R.16 Asistencia ──────────────────────────────────────────
function pdfAsistencia(d, res) {
  const p = crearDocumento('Reporte de asistencia', d.desde, d.hasta);
  p.portada();
  p.destacados([['Total de asistencias', String(d.total)], ['Alumnos distintos', String(d.porAlumno.length)], ['Bloques con asistencia', String(d.porBloque.length)]]);

  p.seccion('Resumen por bloque');
  p.tabla(
    [{ h: 'Día', w: 70 }, { h: 'Horario', w: 90 }, { h: 'Disciplina', w: 130 }, { h: 'Instructor', w: 150 }, { h: 'Asistencias', w: 75, align: 'right' }],
    d.porBloque.map((b) => [b.dia, b.horario, b.disciplina, b.instructor, b.asistencias]),
    ['Total', '', '', '', d.total]
  );

  p.seccion('Resumen por alumno');
  p.tabla(
    [{ h: 'Alumno', w: 415 }, { h: 'Asistencias', w: 100, align: 'right' }],
    d.porAlumno.map((a) => [a.alumno, a.asistencias]),
    ['Total', d.total]
  );

  p.seccion('Detalle de asistencias');
  p.tabla(
    [{ h: 'Fecha', w: 62 }, { h: 'Día', w: 58 }, { h: 'Horario', w: 82 }, { h: 'Disciplina', w: 95 }, { h: 'Instructor', w: 98 }, { h: 'Alumno', w: 120 }],
    d.detalle.map((r) => [fechaCorta(r.fecha), r.dia, r.horario, r.disciplina, r.instructor, r.alumno]),
    ['Total', '', '', '', '', d.total + ' asistencias']
  );
  p.finalizar(res);
}

// ── R.17 Ocupación e ingresos ────────────────────────────────
function pdfOcupacionIngresos(d, res) {
  const p = crearDocumento('Reporte de ocupación e ingresos', d.desde, d.hasta);
  const o = d.ocupacion;
  const g = d.ingresos;
  p.portada();
  p.destacados([['Ingresos del período', clp(g.total)], ['Pagos (no anulados)', String(g.numeroPagos)], ['Asistencias del período', String(o.totales.asistencias)]]);

  p.seccion('Ocupación por bloque');
  p.tabla(
    [{ h: 'Día', w: 58 }, { h: 'Horario', w: 74 }, { h: 'Disciplina', w: 85 }, { h: 'Cap.', w: 35, align: 'right' }, { h: 'Inscr.', w: 40, align: 'right' },
      { h: '% inscr.', w: 50, align: 'right' }, { h: 'Sesiones', w: 50, align: 'right' }, { h: 'Asist.', w: 40, align: 'right' }, { h: '% asist.', w: 83, align: 'right' }],
    o.bloques.map((b) => [b.dia, b.horario, b.disciplina, b.capacidad, b.inscritos, b.pct_inscripcion + '%', b.sesiones, b.asistencias, b.pct_asistencia + '%']),
    ['Total', '', '', o.totales.capacidad, o.totales.inscritos, '', '', o.totales.asistencias, '']
  );
  p.nota('Inscritos = reservas vigentes hoy. % asist. = asistencias / (sesiones del período x capacidad).');

  p.seccion('Ingresos por plan');
  p.tabla(
    [{ h: 'Plan', w: 315 }, { h: 'Pagos', w: 80, align: 'right' }, { h: 'Monto', w: 120, align: 'right' }],
    g.porPlan.map((r) => [r.nombre, r.pagos, clp(r.monto)]),
    ['Total', g.numeroPagos, clp(g.total)]
  );

  p.seccion('Ingresos por método de pago');
  p.tabla(
    [{ h: 'Método', w: 315 }, { h: 'Pagos', w: 80, align: 'right' }, { h: 'Monto', w: 120, align: 'right' }],
    g.porMetodo.map((r) => [r.nombre, r.pagos, clp(r.monto)]),
    ['Total', g.numeroPagos, clp(g.total)]
  );

  p.seccion('Detalle de pagos');
  p.tabla(
    [{ h: 'Fecha', w: 65 }, { h: 'Cliente', w: 170 }, { h: 'Plan', w: 130 }, { h: 'Método', w: 70 }, { h: 'Monto', w: 80, align: 'right' }],
    g.detalle.map((r) => [fechaCorta(r.fecha_pago), r.cliente, r.plan, r.metodo, clp(r.monto)]),
    ['Total', '', '', '', clp(g.total)]
  );
  p.finalizar(res);
}

module.exports = { pdfAsistencia, pdfOcupacionIngresos, clp };
