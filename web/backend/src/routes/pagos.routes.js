const { Router } = require('express');
const { listarPagos, registrarPago, anular } = require('../controllers/pagos.controller');
const authMiddleware = require('../middlewares/auth');
const adminOnly = require('../middlewares/adminOnly');

const router = Router();
const admin = [authMiddleware, adminOnly];

// Sin DELETE: los pagos no se borran, se anulan.
router.get('/',             ...admin, listarPagos);
router.post('/',            ...admin, registrarPago);
router.patch('/:id/anular', ...admin, anular);

module.exports = router;
