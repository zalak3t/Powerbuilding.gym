const { Router } = require('express');
const {
  listarClientes, fichaCliente, crearCliente,
  editarCliente, cambiarEstado, eliminarCliente,
} = require('../controllers/clientes.controller');
const { marcasDeClienteAdmin } = require('../controllers/marcas.controller');
const authMiddleware = require('../middlewares/auth');
const adminOnly = require('../middlewares/adminOnly');

const router = Router();
const admin = [authMiddleware, adminOnly];

router.get('/',            ...admin, listarClientes);
router.get('/:id',         ...admin, fichaCliente);
router.get('/:id/marcas',  ...admin, marcasDeClienteAdmin);
router.post('/',           ...admin, crearCliente);
router.put('/:id',         ...admin, editarCliente);
router.patch('/:id/estado',...admin, cambiarEstado);
router.delete('/:id',      ...admin, eliminarCliente);

module.exports = router;
