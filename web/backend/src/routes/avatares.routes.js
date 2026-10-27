const { Router } = require('express');
const { avatares } = require('../controllers/marcas.controller');
const authMiddleware = require('../middlewares/auth');
const adminOnly = require('../middlewares/adminOnly');

const router = Router();

// GET /api/avatares?ids=1,2,3  -> miniaturas de varios clientes en una sola consulta (solo admin)
router.get('/', authMiddleware, adminOnly, avatares);

module.exports = router;
