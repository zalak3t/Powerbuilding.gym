const { Router } = require('express');
const {
  listarBloques,
  listarBloquesAdmin, crearBloque, editarBloque, cambiarEstado, eliminarBloque,
} = require('../controllers/bloques.controller');
const optionalAuth = require('../middlewares/optionalAuth');
const authMiddleware = require('../middlewares/auth');
const adminOnly = require('../middlewares/adminOnly');

const router = Router();
const admin = [authMiddleware, adminOnly];

// ── Público ───────────────────────────────────────────────────────────────────
router.get('/', optionalAuth, listarBloques);

// ── Admin (estático antes que dinámico para evitar conflicto con /:id) ────────
router.get('/admin',       ...admin, listarBloquesAdmin);
router.post('/',           ...admin, crearBloque);
router.put('/:id',         ...admin, editarBloque);
router.patch('/:id/estado',...admin, cambiarEstado);
router.delete('/:id',      ...admin, eliminarBloque);

module.exports = router;
