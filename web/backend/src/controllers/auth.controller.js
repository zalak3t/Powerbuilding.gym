const {
  findUserByEmail,
  verifyPassword,
  generateToken,
  createUserWithClient,
  getUserById,
  existeFichaSinCuenta,
  generarTokenVerificacion,
  leerTokenVerificacion,
} = require('../services/auth.service');
const { enviarCorreoSinRegistro } = require('../services/email.service');
const v = require('../utils/validate');
const { validarFortaleza } = require('../utils/password');

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
  const errPassword = validarFortaleza(password);
  if (errPassword) {
    return res.status(400).json({ ok: false, error: errPassword });
  }

  const existing = await findUserByEmail(email);
  if (existing) {
    return res.status(409).json({ ok: false, error: 'El email ya está registrado' });
  }

  const datos = { nombre: nombre.trim(), email: email.trim(), telefono: telefono ? telefono.trim() : telefono, password };

  // El gimnasio ya tiene una ficha con este correo: no se crea ni enlaza nada hasta que la persona
  // confirme que el correo es suyo (enlace de un solo uso lógico, 24 h, sin estado en la base).
  if (await existeFichaSinCuenta(datos.email)) {
    const token = await generarTokenVerificacion(datos);
    const base = String(process.env.FRONTEND_URL || '').replace(/\/+$/, '');
    const enlace = `${base}/#verificar=${token}`;
    const envio = await enviarCorreoSinRegistro({
      destinatario: datos.email.toLowerCase(),
      asunto: 'Confirma tu correo en Powerbuilding.gym',
      texto: `Hola ${datos.nombre},\n\nRecibimos una solicitud para crear una cuenta en Powerbuilding.gym con este correo. Para confirmar que es tuyo y activar tu cuenta, abre este enlace (vale 24 horas):\n\n${enlace}\n\nSi no fuiste tú, ignora este mensaje: no se creará ninguna cuenta.`,
    });
    // Sin proveedor real de correo (modo simulado) el mensaje no llegaría a nadie: solo se admite en local.
    const soloLocal = process.env.PB_LOCAL === '1';
    if (envio.estado === 'error' || (envio.estado === 'simulado' && !soloLocal)) {
      return res.status(503).json({ ok: false, error: 'No pudimos enviar el correo de confirmación. Intenta nuevamente en unos minutos.' });
    }
    const respuesta = {
      ok: true,
      pendiente_verificacion: true,
      message: 'Te enviamos un correo para confirmar tu dirección. Abre el enlace para activar tu cuenta (revisa también spam).',
    };
    // Solo en modo local (PB_LOCAL=1, `npm run dev:local`) y sin proveedor real: se devuelve el enlace
    // para poder probar el flujo. Nunca en el servidor desplegado.
    if (envio.estado === 'simulado' && soloLocal) respuesta.enlace_desarrollo = enlace;
    return res.status(202).json(respuesta);
  }

  let user;
  try {
    user = await createUserWithClient(datos);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ ok: false, error: 'El email ya está registrado' });
    throw err;
  }

  return res.status(201).json({
    ok: true,
    message: 'Usuario registrado correctamente',
    user: { id: user.id, nombre: user.nombre, email: user.email, rol: user.rol },
  });
}

// POST /api/auth/verificar-correo  { token }
// Crea la cuenta del registro pendiente y enlaza la ficha existente del gimnasio.
async function verificarCorreo(req, res) {
  const { token } = req.body || {};
  const datos = v.isNonEmptyString(token) ? leerTokenVerificacion(token) : null;
  if (!datos) {
    return res.status(400).json({ ok: false, error: 'El enlace no es válido o venció. Regístrate nuevamente.' });
  }

  // Idempotente: si el enlace se abre dos veces, la segunda solo informa que la cuenta ya existe.
  if (await findUserByEmail(datos.email)) {
    return res.json({ ok: true, ya_verificada: true, message: 'Tu cuenta ya estaba activa. Inicia sesión.' });
  }

  try {
    await createUserWithClient(datos, { vincularFicha: true });
  } catch (err) {
    if (err.code === '23505') {
      return res.json({ ok: true, ya_verificada: true, message: 'Tu cuenta ya estaba activa. Inicia sesión.' });
    }
    throw err;
  }
  return res.status(201).json({ ok: true, message: 'Correo confirmado. Tu cuenta está activa: ya puedes iniciar sesión.' });
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

module.exports = { register, verificarCorreo, login, me };
