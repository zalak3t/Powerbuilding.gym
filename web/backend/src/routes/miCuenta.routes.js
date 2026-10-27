const { Router } = require('express');
const c = require('../controllers/miCuenta.controller');
const authMiddleware = require('../middlewares/auth');
const alumnoCliente = require('../middlewares/alumnoCliente');

const router = Router();
// Solo alumnos; el cliente se obtiene del JWT (nunca de un id en la URL).
const alumno = [authMiddleware, alumnoCliente];

router.get('/perfil',         ...alumno, c.perfil);
router.patch('/perfil',       ...alumno, c.editarPerfil);
router.get('/foto',           ...alumno, c.verFoto);
router.put('/foto',           ...alumno, c.subirFoto);
router.delete('/foto',        ...alumno, c.quitarFoto);
router.post('/password',      ...alumno, c.cambiarPassword);
router.get('/pagos',          ...alumno, c.pagos);
router.get('/marcas',         ...alumno, c.verMarcas);
router.post('/marcas',        ...alumno, c.crearMarca);
router.delete('/marcas/:id',  ...alumno, c.borrarMarca);
router.get('/reservas',       ...alumno, c.reservas);
router.get('/asistencia',     ...alumno, c.asistencia);

module.exports = router;
