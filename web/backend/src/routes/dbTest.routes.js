const { Router } = require('express');
const { dbTest } = require('../controllers/dbTest.controller');

const router = Router();

router.get('/', dbTest);

module.exports = router;
