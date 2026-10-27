// Inspección estructural de un JPEG por su contenido (sin dependencias).
// Recorre los marcadores hasta el SOF para leer ancho/alto reales y exige el EOI final.
// Rechaza EXIF/XMP (APP1) y comentarios (COM). No decodifica los píxeles.

const SOF_SOPORTADOS = [0xc0, 0xc1, 0xc2]; // baseline, extendido y progresivo (Huffman)

// Devuelve { ok: true, width, height } o { ok: false, error }.
function inspeccionarJpeg(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 4) return { ok: false, error: 'Archivo vacío o demasiado corto' };
  if (buf[0] !== 0xff || buf[1] !== 0xd8 || buf[2] !== 0xff) return { ok: false, error: 'El contenido no es una imagen JPEG' };
  if (buf[buf.length - 2] !== 0xff || buf[buf.length - 1] !== 0xd9) return { ok: false, error: 'JPEG incompleto' };

  let i = 2;
  let dim = null;
  while (i < buf.length) {
    if (buf[i] !== 0xff) return { ok: false, error: 'JPEG corrupto' };
    while (buf[i] === 0xff && i < buf.length) i++; // bytes de relleno
    const m = buf[i];
    i++;
    if (m === undefined) return { ok: false, error: 'JPEG corrupto' };
    if (m === 0xd8 || m === 0x01 || (m >= 0xd0 && m <= 0xd7)) continue; // marcadores sin longitud
    if (m === 0xd9) break; // EOI
    if (i + 2 > buf.length) return { ok: false, error: 'JPEG corrupto' };
    const len = buf.readUInt16BE(i);
    if (len < 2 || i + len > buf.length) return { ok: false, error: 'JPEG corrupto' };

    if (m === 0xe1) return { ok: false, error: 'La imagen contiene metadatos (EXIF); vuelve a guardarla sin ellos' };
    if (m === 0xfe) return { ok: false, error: 'La imagen contiene comentarios incrustados' };

    if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) { // SOFn
      if (!SOF_SOPORTADOS.includes(m)) return { ok: false, error: 'Tipo de JPEG no soportado' };
      if (len < 8) return { ok: false, error: 'JPEG corrupto' };
      const height = buf.readUInt16BE(i + 3);
      const width = buf.readUInt16BE(i + 5);
      if (buf[i + 2] !== 8 || !width || !height) return { ok: false, error: 'JPEG corrupto' };
      dim = { width, height };
    }
    if (m === 0xda) { // SOS: lo que sigue son datos entropicos hasta el EOI
      if (!dim) return { ok: false, error: 'JPEG corrupto' };
      return { ok: true, width: dim.width, height: dim.height };
    }
    i += len;
  }
  return { ok: false, error: 'JPEG corrupto' };
}

module.exports = { inspeccionarJpeg };
