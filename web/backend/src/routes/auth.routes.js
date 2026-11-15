const { Router } = require('express');
const { register, login, me } = require('../controllers/auth.controller');
const authMiddleware = require('../middlewares/auth');
const { loginLimiter, registerLimiter } = require('../middlewares/rateLimit');

const router = Router();

router.post('/register', registerLimiter, register);
router.post('/login',    loginLimiter, login);
router.get('/me',        authMiddleware, me);

module.exports = router;
