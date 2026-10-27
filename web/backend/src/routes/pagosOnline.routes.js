const express = require('express');
const authMiddleware = require('../middlewares/auth');
const adminOnly = require('../middlewares/adminOnly');
const c = require('../controllers/pagosOnline.controller');

const router = express.Router();
const admin = [authMiddleware, adminOnly];

// Rutas estaticas antes que /:id
router.get('/estado', c.estado);
router.get('/planes', authMiddleware, c.planes);
router.post('/iniciar', authMiddleware, c.iniciar);

// Webpay vuelve por GET o por POST (form-urlencoded): solo aqui se parsea urlencoded.
const urlencoded = express.urlencoded({ extended: false, limit: '10kb' });
router.get('/retorno', c.retorno);
router.post('/retorno', urlencoded, c.retorno);

router.get('/', ...admin, c.listar);
router.post('/:id/reintentar-documento', ...admin, c.reintentarDocumento);
router.get('/:id/documento', authMiddleware, c.documento);
router.get('/:id', authMiddleware, c.obtener);

module.exports = router;
