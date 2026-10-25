const { Router } = require('express');
const {
  listarPlanes, crearPlan, editarPlan, cambiarEstadoPlan, eliminarPlan,
} = require('../controllers/planes.controller');
const authMiddleware = require('../middlewares/auth');
const adminOnly = require('../middlewares/adminOnly');

const router = Router();
const admin = [authMiddleware, adminOnly];

router.get('/',             ...admin, listarPlanes);
router.post('/',            ...admin, crearPlan);
router.put('/:id',          ...admin, editarPlan);
router.patch('/:id/estado', ...admin, cambiarEstadoPlan);
router.delete('/:id',       ...admin, eliminarPlan);

module.exports = router;
