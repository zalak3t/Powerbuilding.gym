const express = require('express');
const authMiddleware = require('../middlewares/auth');
const adminOnly = require('../middlewares/adminOnly');
const { listar, ejecutar, estado } = require('../controllers/notificaciones.controller');

const router = express.Router();
const admin = [authMiddleware, adminOnly];

router.get('/estado', ...admin, estado);
router.get('/', ...admin, listar);
router.post('/ejecutar', ...admin, ejecutar);

module.exports = router;
