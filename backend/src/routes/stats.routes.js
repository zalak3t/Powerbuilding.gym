const { Router } = require('express');
const { getDashboard, getNegocio } = require('../controllers/stats.controller');
const authMiddleware = require('../middlewares/auth');
const adminOnly = require('../middlewares/adminOnly');

const router = Router();
const admin = [authMiddleware, adminOnly];

router.get('/dashboard', ...admin, getDashboard);
router.get('/negocio',   ...admin, getNegocio);

module.exports = router;
