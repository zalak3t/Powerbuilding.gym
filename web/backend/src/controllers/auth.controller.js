const {
  findUserByEmail,
  verifyPassword,
  generateToken,
  createUserWithClient,
  getUserById,
} = require('../services/auth.service');
const v = require('../utils/validate');

async function register(req, res) {
  const { nombre, email, password, telefono } = req.body;

  if (!v.isNonEmptyString(nombre) || !v.isNonEmptyString(email) || !v.isString(password) || !password) {
    return res.status(400).json({ ok: false, error: 'nombre, email y password son obligatorios' });
  }
  if (!v.maxLen(nombre.trim(), 100)) {
    return res.status(400).json({ ok: false, error: 'El nombre no puede superar 100 caracteres' });
  }
  if (!v.isEmail(email) || !v.maxLen(email.trim(), 150)) {
    return res.status(400).json({ ok: false, error: 'Email inválido (máximo 150 caracteres)' });
  }
  if (!v.isOptionalString(telefono, 20)) {
    return res.status(400).json({ ok: false, error: 'El teléfono no puede superar 20 caracteres' });
  }
  if (!v.minLen(password, 8)) {
    return res.status(400).json({ ok: false, error: 'La contraseña debe tener al menos 8 caracteres' });
  }
  if (!v.maxLen(password, 72)) {
    return res.status(400).json({ ok: false, error: 'La contraseña no puede superar 72 caracteres' });
  }

  const existing = await findUserByEmail(email);
  if (existing) {
    return res.status(409).json({ ok: false, error: 'El email ya está registrado' });
  }

  const user = await createUserWithClient({ nombre: nombre.trim(), email: email.trim(), telefono: telefono ? telefono.trim() : telefono, password });

  return res.status(201).json({
    ok: true,
    message: 'Usuario registrado correctamente',
    user: { id: user.id, nombre: user.nombre, email: user.email, rol: user.rol },
  });
}

async function login(req, res) {
  const { email, password } = req.body;

  if (!v.isNonEmptyString(email) || !v.isString(password) || !password) {
    return res.status(400).json({ ok: false, error: 'email y password son obligatorios' });
  }

  const user = await findUserByEmail(email.trim());
  if (!user) {
    return res.status(401).json({ ok: false, error: 'Credenciales inválidas' });
  }

  if (!user.activo) {
    return res.status(403).json({ ok: false, error: 'Cuenta desactivada' });
  }

  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) {
    return res.status(401).json({ ok: false, error: 'Credenciales inválidas' });
  }

  const token = generateToken(user);

  return res.json({
    ok: true,
    message: 'Login correcto',
    token,
    user: { id: user.id, nombre: user.nombre, email: user.email, rol: user.rol },
  });
}

async function me(req, res) {
  const user = await getUserById(req.user.id);
  if (!user) {
    return res.status(404).json({ ok: false, error: 'Usuario no encontrado' });
  }
  return res.json({
    ok: true,
    user: { id: user.id, nombre: user.nombre, email: user.email, rol: user.rol },
  });
}

module.exports = { register, login, me };
