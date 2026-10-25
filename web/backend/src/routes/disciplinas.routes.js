const { Router } = require('express');
const {
  listarDisciplinas, crearDisciplina, editarDisciplina, cambiarEstadoDisciplina, eliminarDisciplina,
} = require('../controllers/disciplinas.controller');
const authMiddleware = require('../middlewares/auth');
const adminOnly = require('../middlewares/adminOnly');

const router = Router();
const admin = [authMiddleware, adminOnly];

router.get('/',             ...admin, listarDisciplinas);
router.post('/',            ...admin, crearDisciplina);
router.put('/:id',          ...admin, editarDisciplina);
router.patch('/:id/estado', ...admin, cambiarEstadoDisciplina);
router.delete('/:id',       ...admin, eliminarDisciplina);

module.exports = router;
