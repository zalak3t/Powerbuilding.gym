const { Router } = require('express');
const { dbTest } = require('../controllers/dbTest.controller');
const authMiddleware = require('../middlewares/auth');
const adminOnly = require('../middlewares/adminOnly');

const router = Router();

// Diagnóstico de la base de datos: solo administradores autenticados.
router.get('/', authMiddleware, adminOnly, dbTest);

module.exports = router;
