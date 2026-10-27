// Comprobante de pago en PDF (pdfkit). Documento interno: NO es una boleta electronica
// ni un documento tributario, y asi se indica en el propio PDF.
const PDFDocument = require('pdfkit');

const M = 50;
const COLOR = { texto: '#1a1a1a', tenue: '#444444', linea: '#cccccc', acento: '#111111' };

function fechaCorta(iso) { return iso.slice(8, 10) + '-' + iso.slice(5, 7) + '-' + iso.slice(0, 4); }
function clp(n) { return '$' + String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }

// Folio del comprobante a partir del id del pago: CP-000123
function folioComprobante(pagoId) { return 'CP-' + String(pagoId).padStart(6, '0'); }

/**
 * Genera el PDF y lo devuelve como Buffer.
 * datos: { folio, fechaPago, clienteNombre, clienteEmail, planNombre, periodoDesde, periodoHasta,
 *          monto, metodo, autorizacion, ordenCompra }  (fechas 'YYYY-MM-DD'). Sin datos de tarjeta.
 */
function generarComprobante(datos) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4', margin: M,
        info: { Title: 'Comprobante de pago - Powerbuilding.gym', Author: 'Powerbuilding.gym' },
      });
      const chunks = [];
      doc.on('data', (c) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      const ancho = doc.page.width - M * 2;

      doc.fillColor(COLOR.acento).font('Helvetica-Bold').fontSize(22).text('Powerbuilding.gym', M, M);
      doc.fillColor(COLOR.tenue).font('Helvetica').fontSize(10).text('Camilo Henríquez 3314, Santiago');
      doc.moveDown(1.2);
      doc.fillColor(COLOR.texto).font('Helvetica-Bold').fontSize(18).text('Comprobante de pago');
      doc.font('Helvetica').fontSize(11).fillColor(COLOR.tenue).text('Folio ' + datos.folio + '  ·  Fecha ' + fechaCorta(datos.fechaPago));
      doc.moveDown(0.8);
      doc.moveTo(M, doc.y).lineTo(M + ancho, doc.y).strokeColor(COLOR.linea).stroke();
      doc.moveDown(0.8);

      const filas = [
        ['Cliente', datos.clienteNombre],
        ['Correo', datos.clienteEmail],
        ['Plan', datos.planNombre],
        ['Período', fechaCorta(datos.periodoDesde) + ' al ' + fechaCorta(datos.periodoHasta)],
        ['Medio de pago', datos.metodo === 'webpay' ? 'Webpay Plus' : String(datos.metodo || '')],
      ];
      if (datos.autorizacion) filas.push(['Código de autorización', String(datos.autorizacion)]);
      if (datos.ordenCompra) filas.push(['Orden de compra', String(datos.ordenCompra)]);
      filas.forEach(([k, v]) => {
        const y = doc.y;
        doc.fillColor(COLOR.tenue).font('Helvetica').fontSize(10).text(k, M, y, { width: 150 });
        doc.fillColor(COLOR.texto).font('Helvetica').fontSize(11).text(v || '-', M + 160, y, { width: ancho - 160 });
        doc.moveDown(0.4);
      });

      doc.moveDown(0.8);
      doc.moveTo(M, doc.y).lineTo(M + ancho, doc.y).strokeColor(COLOR.linea).stroke();
      doc.moveDown(0.8);
      doc.fillColor(COLOR.texto).font('Helvetica-Bold').fontSize(14).text('Total pagado: ' + clp(datos.monto), M, doc.y);

      doc.moveDown(2);
      doc.fillColor(COLOR.tenue).font('Helvetica').fontSize(9).text(
        'Este documento es un comprobante de pago interno de Powerbuilding.gym. No constituye boleta electrónica ni documento tributario.',
        M, doc.y, { width: ancho }
      );
      doc.end();
    } catch (e) {
      reject(e);
    }
  });
}

module.exports = { generarComprobante, folioComprobante, clp };
