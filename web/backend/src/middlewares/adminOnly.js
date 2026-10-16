function adminOnly(req, res, next) {
  if (!req.user || req.user.rol !== 'admin') {
    return res.status(403).json({ ok: false, error: 'Acceso restringido a administradores' });
  }
  next();
}

module.exports = adminOnly;
