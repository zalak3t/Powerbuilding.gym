const { Router } = require('express');
const {
  listarInstructores, crearInstructor, editarInstructor, cambiarEstadoInstructor, eliminarInstructor,
} = require('../controllers/instructores.controller');
const authMiddleware = require('../middlewares/auth');
const adminOnly = require('../middlewares/adminOnly');

const router = Router();
const admin = [authMiddleware, adminOnly];

router.get('/',             ...admin, listarInstructores);
router.post('/',            ...admin, crearInstructor);
router.put('/:id',          ...admin, editarInstructor);
router.patch('/:id/estado', ...admin, cambiarEstadoInstructor);
router.delete('/:id',       ...admin, eliminarInstructor);

module.exports = router;
