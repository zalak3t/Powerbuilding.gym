const jwt = require('jsonwebtoken');
const { getUserById } = require('../services/auth.service');

async function optionalAuth(req, res, next) {
  const header = req.headers['authorization'];
  if (!header) { req.user = null; return next(); }

  if (!header.startsWith('Bearer ')) {
    return res.status(401).json({ ok: false, error: 'Formato de token inválido' });
  }

  const token = header.slice(7);
  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ ok: false, error: 'Token inválido o expirado' });
  }

  const user = await getUserById(payload.id);
  if (!user || !user.activo) {
    return res.status(401).json({ ok: false, error: 'Usuario no autorizado' });
  }

  req.user = user;
  next();
}

module.exports = optionalAuth;
