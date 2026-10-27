const { query } = require('../config/db');

// Usar después de authMiddleware. Solo rol alumno; el cliente SIEMPRE sale del usuario del token
// (clientes.usuario_id), nunca de la URL, query o body.
async function alumnoCliente(req, res, next) {
  if (!req.user || req.user.rol !== 'alumno') {
    return res.status(403).json({ ok: false, error: 'Acceso restringido a alumnos' });
  }
  const r = await query('SELECT id, nombre, email, telefono, estado FROM clientes WHERE usuario_id = $1', [req.user.id]);
  if (!r.rows[0]) {
    return res.status(404).json({ ok: false, error: 'Tu cuenta no tiene un perfil de cliente asociado' });
  }
  req.cliente = r.rows[0];
  next();
}

module.exports = alumnoCliente;
