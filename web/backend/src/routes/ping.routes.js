const { Router } = require('express');
const { ping } = require('../controllers/ping.controller');

const router = Router();

router.get('/', ping);

module.exports = router;
