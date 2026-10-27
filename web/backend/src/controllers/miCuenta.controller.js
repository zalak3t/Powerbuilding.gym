const svc = require('../services/miCuenta.service');
const fotos = require('../services/fotos.service');
const marcas = require('../services/marcas.service');
const v = require('../utils/validate');
const { validarFortaleza } = require('../utils/password');

// Todas las funciones usan req.cliente / req.user (resueltos desde el JWT en alumnoCliente);
// ningún id de cliente se toma de la URL, query ni body.

async function perfil(req, res) {
  const p = await svc.getPerfil(req.cliente.id);
  return res.json({ ok: true, perfil: p });
}

async function editarPerfil(req, res) {
  const { nombre, telefono } = req.body || {};
  if (!v.isNonEmptyString(nombre) || !v.maxLen(nombre.trim(), 100)) {
    return res.status(400).json({ ok: false, error: 'El nombre es obligatorio (máximo 100 caracteres)' });
  }
  if (!v.isOptionalString(telefono, 20)) {
    return res.status(400).json({ ok: false, error: 'El teléfono no puede superar 20 caracteres' });
  }
  const tel = typeof telefono === 'string' && telefono.trim() ? telefono.trim() : null;
  await svc.updatePerfil(req.user.id, req.cliente.id, { nombre: nombre.trim(), telefono: tel });
  return res.json({ ok: true, message: 'Perfil actualizado' });
}

// PUT /foto  { foto, miniatura }  (JPEG en base64 sin prefijo data:)
async function subirFoto(req, res) {
  const { foto, miniatura } = req.body || {};
  const r = fotos.validarFotoYMiniatura(foto, miniatura);
  if (r.error) return res.status(400).json({ ok: false, error: r.error });
  await fotos.guardarFoto(req.cliente.id, r.foto, r.miniatura);
  return res.json({ ok: true, message: 'Foto actualizada', miniatura: await fotos.miniaturaDataUri(req.cliente.id) });
}

async function verFoto(req, res) {
  const f = await fotos.obtenerFoto(req.cliente.id);
  if (!f) return res.status(404).json({ ok: false, error: 'Sin foto de perfil' });
  res.set({
    'Content-Type': f.mime,
    'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  return res.send(f.foto);
}

async function quitarFoto(req, res) {
  await fotos.borrarFoto(req.cliente.id);
  return res.json({ ok: true, message: 'Foto eliminada' });
}

// Mensajes de la acción 'actual incorrecta' van con 400 (no 401: el frontend trataría un 401 como sesión expirada).
async function cambiarPassword(req, res) {
  const { actual, nueva } = req.body || {};
  if (!v.isString(actual) || !actual || !v.isString(nueva) || !nueva) {
    return res.status(400).json({ ok: false, error: 'actual y nueva son obligatorias' });
  }
  const err = validarFortaleza(nueva);
  if (err) return res.status(400).json({ ok: false, error: err });

  const r = await svc.cambiarPassword(req.user.id, actual, nueva);
  if (r === 'BLOQUEADO') return res.status(429).json({ ok: false, error: 'Demasiados intentos. Espera 15 minutos e inténtalo de nuevo' });
  if (r === 'ACTUAL_INCORRECTA') return res.status(400).json({ ok: false, error: 'La contraseña actual no es correcta' });
  if (r === 'IGUAL') return res.status(400).json({ ok: false, error: 'La nueva contraseña debe ser distinta de la actual' });
  if (r !== 'OK') return res.status(404).json({ ok: false, error: 'Usuario no encontrado' });
  return res.json({ ok: true, message: 'Contraseña actualizada' });
}

async function pagos(req, res) {
  return res.json({ ok: true, pagos: await svc.listarPagos(req.cliente.id) });
}

async function verMarcas(req, res) {
  return res.json({ ok: true, ...(await marcas.marcasDeCliente(req.cliente.id)) });
}

async function crearMarca(req, res) {
  const d = marcas.validarMarca(req.body);
  if (d.error) return res.status(400).json({ ok: false, error: d.error });
  const r = await marcas.crearMarca(req.cliente.id, d);
  if (r.error === 'LIMITE') {
    return res.status(409).json({ ok: false, error: 'Alcanzaste el máximo de ' + marcas.MAX_MARCAS_POR_CLIENTE + ' marcas' });
  }
  return res.status(201).json({ ok: true, message: 'Marca registrada', marca: r.marca });
}

async function borrarMarca(req, res) {
  const id = v.parsePositiveInt(req.params.id);
  if (!id) return res.status(400).json({ ok: false, error: 'ID inválido' });
  const borrada = await marcas.borrarMarca(req.cliente.id, id);
  if (!borrada) return res.status(404).json({ ok: false, error: 'Marca no encontrada' });
  return res.json({ ok: true, message: 'Marca eliminada' });
}

async function reservas(req, res) {
  return res.json({ ok: true, reservas: await svc.listarReservas(req.cliente.id) });
}

async function asistencia(req, res) {
  return res.json({ ok: true, ...(await svc.listarAsistencia(req.cliente.id)) });
}

module.exports = {
  perfil, editarPerfil, subirFoto, verFoto, quitarFoto, cambiarPassword,
  pagos, verMarcas, crearMarca, borrarMarca, reservas, asistencia,
};
