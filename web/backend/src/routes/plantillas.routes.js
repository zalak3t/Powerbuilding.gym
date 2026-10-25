const { Router } = require('express');
const {
  listarPlantillas, obtenerPlantilla, editarPlantilla, previsualizarPlantilla,
} = require('../controllers/plantillas.controller');
const authMiddleware = require('../middlewares/auth');
const adminOnly = require('../middlewares/adminOnly');

const router = Router();
const admin = [authMiddleware, adminOnly];

// Sin crear ni borrar: las 3 plantillas vienen de la migración 002.
router.get('/',             ...admin, listarPlantillas);
router.get('/:id',          ...admin, obtenerPlantilla);
router.put('/:id',          ...admin, editarPlantilla);
router.post('/:id/preview', ...admin, previsualizarPlantilla);

module.exports = router;
