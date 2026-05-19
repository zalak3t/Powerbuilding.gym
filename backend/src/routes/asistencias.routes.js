const { Router } = require('express');
const { listarAsistencias, marcarAsistencia, desmarcarAsistencia } = require('../controllers/asistencias.controller');
const authMiddleware = require('../middlewares/auth');
const adminOnly = require('../middlewares/adminOnly');

const router = Router();
const admin = [authMiddleware, adminOnly];

router.get('/',     ...admin, listarAsistencias);
router.post('/',    ...admin, marcarAsistencia);
router.delete('/:id', ...admin, desmarcarAsistencia);

module.exports = router;
