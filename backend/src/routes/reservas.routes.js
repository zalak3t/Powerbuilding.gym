const { Router } = require('express');
const { reservar, cancelar } = require('../controllers/reservas.controller');
const authMiddleware = require('../middlewares/auth');

const router = Router();

router.post('/',    authMiddleware, reservar);
router.delete('/:id', authMiddleware, cancelar);

module.exports = router;
