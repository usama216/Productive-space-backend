const express = require('express');
const router = express.Router();
const simpleTestController = require('../controllers/simpleTestController');

router.get('/test-db', simpleTestController.testDatabase);

module.exports = router;
