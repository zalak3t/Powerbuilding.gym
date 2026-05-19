const jwt = require('jsonwebtoken');
const { getUserById } = require('../services/auth.service');

async function authMiddleware(req, res, next) {
  const header = req.headers['authorization'];
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ ok: false, error: 'Token requerido' });
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

module.exports = authMiddleware;
