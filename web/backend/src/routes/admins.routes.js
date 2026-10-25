const { Router } = require('express');
const { listarAdmins, crearAdmin, editarAdmin, eliminarAdmin } = require('../controllers/admins.controller');
const authMiddleware = require('../middlewares/auth');
const adminOnly = require('../middlewares/adminOnly');

const router = Router();
const admin = [authMiddleware, adminOnly];

router.get('/',       ...admin, listarAdmins);
router.post('/',      ...admin, crearAdmin);
router.put('/:id',    ...admin, editarAdmin);
router.delete('/:id', ...admin, eliminarAdmin);

module.exports = router;
