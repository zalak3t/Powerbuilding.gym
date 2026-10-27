// Limpieza e inspección estructural de un JPEG por su contenido (sin dependencias, sin re-codificar).
// Recorre los marcadores (incluidos los que aparecen entre escaneos, tras los datos comprimidos), lee
// ancho/alto del SOF y devuelve una copia SIN metadatos: se cortan los segmentos APP1 (EXIF/XMP),
// APP3 a APP13, APP15 y los comentarios (COM). Se conservan APP0 (JFIF), APP2 (perfil de color) y APP14
// (Adobe), que influyen en cómo se pintan los colores. Todo lo que haya después del EOI se descarta.
// No decodifica los píxeles.

const SOF_SOPORTADOS = [0xc0, 0xc1, 0xc2]; // baseline, extendido y progresivo (Huffman)

// APP1, APP3..APP13, APP15 y COM
function esMetadato(m) {
  return m === 0xe1 || (m >= 0xe3 && m <= 0xed) || m === 0xef || m === 0xfe;
}

const fallo = (error) => ({ ok: false, error });
const CORRUPTO = fallo('JPEG corrupto');

// Devuelve { ok: true, buffer, width, height, quitados, sobrantes } o { ok: false, error }.
// quitados = segmentos de metadatos eliminados; sobrantes = bytes descartados tras el EOI.
function limpiarJpeg(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 4) return fallo('Archivo vacío o demasiado corto');
  if (buf[0] !== 0xff || buf[1] !== 0xd8 || buf[2] !== 0xff) return fallo('El contenido no es una imagen JPEG');

  const partes = [Buffer.from([0xff, 0xd8])];
  let i = 2;
  let dim = null;
  let sos = false;
  let eoi = false;
  let quitados = 0;

  while (i < buf.length) {
    if (buf[i] !== 0xff) return CORRUPTO;
    while (buf[i] === 0xff && i < buf.length) i++; // bytes de relleno
    const m = buf[i];
    i++;
    if (m === undefined || m === 0x00 || m === 0xd8) return CORRUPTO;
    if (m === 0xd9) { partes.push(Buffer.from([0xff, 0xd9])); eoi = true; break; } // EOI
    if (m === 0x01 || (m >= 0xd0 && m <= 0xd7)) { partes.push(Buffer.from([0xff, m])); continue; } // sin longitud

    if (i + 2 > buf.length) return CORRUPTO;
    const len = buf.readUInt16BE(i);
    if (len < 2 || i + len > buf.length) return CORRUPTO;
    const fin = i + len;

    if (esMetadato(m)) { quitados++; i = fin; continue; }

    if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) { // SOFn
      if (!SOF_SOPORTADOS.includes(m)) return fallo('Tipo de JPEG no soportado');
      if (len < 8 || dim) return CORRUPTO;
      const height = buf.readUInt16BE(i + 3);
      const width = buf.readUInt16BE(i + 5);
      if (buf[i + 2] !== 8 || !width || !height) return CORRUPTO;
      dim = { width, height };
    }

    partes.push(Buffer.from([0xff, m]), buf.subarray(i, fin));
    i = fin;

    if (m === 0xda) { // SOS: datos comprimidos hasta el siguiente marcador real
      if (!dim) return CORRUPTO;
      sos = true;
      let j = i;
      while (j < buf.length) {
        if (buf[j] !== 0xff) { j++; continue; }
        const n = buf[j + 1];
        if (n === undefined) break;
        if (n === 0x00 || (n >= 0xd0 && n <= 0xd7)) { j += 2; continue; } // relleno o reinicio: sigue siendo dato
        if (n === 0xff) { j++; continue; }
        break; // marcador real en j
      }
      partes.push(buf.subarray(i, j));
      i = j;
    }
  }

  if (!eoi) return fallo('JPEG incompleto');
  if (!dim || !sos) return CORRUPTO;
  return {
    ok: true,
    buffer: Buffer.concat(partes),
    width: dim.width,
    height: dim.height,
    quitados,
    sobrantes: buf.length - i,
  };
}

module.exports = { limpiarJpeg };
