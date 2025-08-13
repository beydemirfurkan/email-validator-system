const express = require('express');
const EmailValidationService = require('../services/EmailValidationService');
const ResponseUtils = require('../utils/responseUtils');

const router = express.Router();
const emailValidator = new EmailValidationService();

router.get('/cache', (req, res) => {
    try {
        const cacheStats = emailValidator.getCacheStatistics();
        const cachedDomains = emailValidator.getCachedDomains();
        
        res.json({
            success: true,
            cache_statistics: cacheStats,
            cached_domains: cachedDomains,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Cache stats error:', error);
        res.status(500).json(
            ResponseUtils.serverError('Error retrieving cache statistics', error)
        );
    }
});

router.post('/cache/clear', (req, res) => {
    try {
        emailValidator.clearMxCache();
        
        res.json({
            success: true,
            message: 'MX cache cleared successfully',
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Cache clear error:', error);
        res.status(500).json(
            ResponseUtils.serverError('Error clearing cache', error)
        );
    }
});

module.exports = router;