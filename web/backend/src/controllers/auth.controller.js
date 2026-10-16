const {
  findUserByEmail,
  verifyPassword,
  generateToken,
  createUserWithClient,
  getUserById,
} = require('../services/auth.service');

async function register(req, res) {
  const { nombre, email, password, telefono } = req.body;

  if (!nombre || !email || !password) {
    return res.status(400).json({ ok: false, error: 'nombre, email y password son obligatorios' });
  }

  const existing = await findUserByEmail(email);
  if (existing) {
    return res.status(409).json({ ok: false, error: 'El email ya está registrado' });
  }

  const user = await createUserWithClient({ nombre, email, telefono, password });

  return res.status(201).json({
    ok: true,
    message: 'Usuario registrado correctamente',
    user: { id: user.id, nombre: user.nombre, email: user.email, rol: user.rol },
  });
}

async function login(req, res) {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ ok: false, error: 'email y password son obligatorios' });
  }

  const user = await findUserByEmail(email);
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
