const express = require('express');
const validationRoutes = require('./validation');
const fileRoutes = require('./file');
const healthRoutes = require('./health');

const router = express.Router();

router.use('/api', validationRoutes);
router.use('/api', fileRoutes);
router.use('/api/health', healthRoutes);

module.exports = router;