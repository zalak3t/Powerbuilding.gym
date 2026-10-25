const { getAdmins, createAdmin, updateAdmin, deleteAdmin } = require('../services/admins.service');
const v = require('../utils/validate');

// Valida nombre/email/teléfono (comunes a crear y editar). Devuelve { error } o los campos normalizados.
function validarDatosAdmin(body) {
  const { nombre, email, telefono } = body || {};
  if (!v.isNonEmptyString(nombre) || !v.isNonEmptyString(email)) {
    return { error: 'nombre y email son obligatorios' };
  }
  if (!v.maxLen(nombre.trim(), 100)) return { error: 'El nombre no puede superar 100 caracteres' };
  if (!v.isEmail(email) || !v.maxLen(email.trim(), 150)) return { error: 'Email inválido (máximo 150 caracteres)' };
  if (!v.isOptionalString(telefono, 20)) return { error: 'El teléfono no puede superar 20 caracteres' };
  return {
    nombre: nombre.trim(),
    email: email.toLowerCase().trim(),
    telefono: telefono && telefono.trim() ? telefono.trim() : null,
  };
}

function validarPassword(password) {
  if (!v.minLen(password, 8)) return 'La contraseña debe tener al menos 8 caracteres';
  if (!v.maxLen(password, 72)) return 'La contraseña no puede superar 72 caracteres';
  return null;
}

const MSG_409 = {
  SELF: 'No puedes desactivar ni eliminar tu propia cuenta',
  LAST: 'No se puede desactivar ni eliminar al último administrador activo',
  HAS_CLIENT: 'No se puede eliminar: este usuario tiene un cliente vinculado. Puedes desactivarlo en su lugar.',
};

// Traduce el código de error de los services a una respuesta HTTP. Devuelve true si respondió.
function responderError(res, code) {
  if (code === 'NOT_FOUND') { res.status(404).json({ ok: false, error: 'Administrador no encontrado' }); return true; }
  if (MSG_409[code]) { res.status(409).json({ ok: false, error: MSG_409[code] }); return true; }
  return false;
}

// GET /api/admins
async function listarAdmins(req, res) {
  const admins = await getAdmins();
  return res.json({ ok: true, admins });
}

// POST /api/admins
async function crearAdmin(req, res) {
  const val = validarDatosAdmin(req.body);
  if (val.error) return res.status(400).json({ ok: false, error: val.error });
  const passError = validarPassword(req.body.password);
  if (passError) return res.status(400).json({ ok: false, error: passError });

  try {
    const admin = await createAdmin({ ...val, password: req.body.password });
    return res.status(201).json({ ok: true, message: 'Administrador creado correctamente', admin });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ ok: false, error: 'El email ya está registrado' });
    throw err;
  }
}

// PUT /api/admins/:id
async function editarAdmin(req, res) {
  const id = v.parsePositiveInt(req.params.id);
  if (!id) return res.status(400).json({ ok: false, error: 'ID inválido' });

  const val = validarDatosAdmin(req.body);
  if (val.error) return res.status(400).json({ ok: false, error: val.error });

  const { activo, password } = req.body;
  if (activo !== undefined && typeof activo !== 'boolean') {
    return res.status(400).json({ ok: false, error: 'activo debe ser true o false' });
  }
  if (password !== undefined && password !== null && password !== '') {
    const passError = typeof password === 'string' ? validarPassword(password) : 'Contraseña inválida';
    if (passError) return res.status(400).json({ ok: false, error: passError });
  }

  try {
    const r = await updateAdmin(id, req.user.id, { ...val, activo, password: password || null });
    if (r.error) { responderError(res, r.error); return; }
    return res.json({ ok: true, message: 'Administrador actualizado correctamente', admin: r.admin });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ ok: false, error: 'El email ya está registrado' });
    throw err;
  }
}

// DELETE /api/admins/:id
async function eliminarAdmin(req, res) {
  const id = v.parsePositiveInt(req.params.id);
  if (!id) return res.status(400).json({ ok: false, error: 'ID inválido' });

  const r = await deleteAdmin(id, req.user.id);
  if (r.error) { responderError(res, r.error); return; }
  return res.json({ ok: true, message: 'Administrador eliminado correctamente' });
}

module.exports = { listarAdmins, crearAdmin, editarAdmin, eliminarAdmin };
