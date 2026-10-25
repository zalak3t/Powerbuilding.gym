const { Router } = require('express');
const { reporteAsistencia, reporteOcupacionIngresos } = require('../controllers/reportes.controller');
const authMiddleware = require('../middlewares/auth');
const adminOnly = require('../middlewares/adminOnly');

const router = Router();
const admin = [authMiddleware, adminOnly];

router.get('/asistencia',          ...admin, reporteAsistencia);
router.get('/ocupacion-ingresos',  ...admin, reporteOcupacionIngresos);

module.exports = router;
