const express = require('express');
const validationRoutes = require('./validation');
const fileRoutes = require('./file');
const healthRoutes = require('./health');
const statsRoutes = require('./stats');

const router = express.Router();

router.use('/api', validationRoutes);
router.use('/api', fileRoutes);
router.use('/api/health', healthRoutes);
router.use('/api/stats', statsRoutes);

module.exports = router;