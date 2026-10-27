const { query } = require('../config/db');
const { inspeccionarJpeg } = require('../utils/jpeg');

// Límites sobre los bytes ya decodificados. El navegador entrega 256 px (foto) y 64 px (miniatura).
const FOTO = { maxBytes: 48 * 1024, minLado: 64, maxLado: 256 };
const MINIATURA = { maxBytes: 6 * 1024, minLado: 16, maxLado: 96 };

const BASE64_RE = /^[A-Za-z0-9+/]+={0,2}$/;

// Valida un base64 (sin prefijo data:) por su contenido real. Devuelve { buf } o { error }.
function validarImagen(b64, limites, nombre) {
  if (typeof b64 !== 'string' || !b64) return { error: nombre + ' es obligatoria' };
  if (b64.length > Math.ceil(limites.maxBytes / 3) * 4 + 4) return { error: nombre + ' supera el tamaño máximo' };
  if (b64.length % 4 !== 0 || !BASE64_RE.test(b64)) return { error: nombre + ' no es base64 válido' };
  const buf = Buffer.from(b64, 'base64');
  if (buf.length > limites.maxBytes) return { error: nombre + ' supera el tamaño máximo' };
  const info = inspeccionarJpeg(buf);
  if (!info.ok) return { error: nombre + ': ' + info.error };
  if (info.width !== info.height) return { error: nombre + ' debe ser cuadrada' };
  if (info.width < limites.minLado || info.width > limites.maxLado) {
    return { error: nombre + ' debe medir entre ' + limites.minLado + ' y ' + limites.maxLado + ' px por lado' };
  }
  return { buf };
}

// Devuelve { error } o { foto: Buffer, miniatura: Buffer }.
function validarFotoYMiniatura(fotoB64, miniaturaB64) {
  const f = validarImagen(fotoB64, FOTO, 'La foto');
  if (f.error) return { error: f.error };
  const m = validarImagen(miniaturaB64, MINIATURA, 'La miniatura');
  if (m.error) return { error: m.error };
  return { foto: f.buf, miniatura: m.buf };
}

async function guardarFoto(clienteId, foto, miniatura) {
  await query(
    `INSERT INTO clientes_foto (cliente_id, foto, miniatura) VALUES ($1, $2, $3)
     ON CONFLICT (cliente_id) DO UPDATE
       SET foto = EXCLUDED.foto, miniatura = EXCLUDED.miniatura, actualizado_en = NOW()`,
    [clienteId, foto, miniatura]
  );
}

async function obtenerFoto(clienteId) {
  const r = await query('SELECT foto, mime FROM clientes_foto WHERE cliente_id = $1', [clienteId]);
  return r.rows[0] || null;
}

async function borrarFoto(clienteId) {
  const r = await query('DELETE FROM clientes_foto WHERE cliente_id = $1', [clienteId]);
  return r.rowCount > 0;
}

const dataUri = (buf) => 'data:image/jpeg;base64,' + buf.toString('base64');

async function miniaturaDataUri(clienteId) {
  const r = await query('SELECT miniatura FROM clientes_foto WHERE cliente_id = $1', [clienteId]);
  return r.rows[0] ? dataUri(r.rows[0].miniatura) : null;
}

// { "<cliente_id>": "data:image/jpeg;base64,..." } solo para los que tienen foto (una sola consulta).
async function miniaturasDe(ids) {
  const r = await query('SELECT cliente_id, miniatura FROM clientes_foto WHERE cliente_id = ANY($1::int[])', [ids]);
  const mapa = {};
  for (const row of r.rows) mapa[row.cliente_id] = dataUri(row.miniatura);
  return mapa;
}

module.exports = {
  FOTO, MINIATURA,
  validarFotoYMiniatura, guardarFoto, obtenerFoto, borrarFoto, miniaturaDataUri, miniaturasDe,
};
