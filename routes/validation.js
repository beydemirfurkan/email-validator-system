const express = require('express');
const EmailValidationService = require('../services/EmailValidationService');
const ResponseUtils = require('../utils/responseUtils');

const router = express.Router();
const emailValidator = new EmailValidationService();

router.post('/validate-email', async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json(
                ResponseUtils.validationError('Email address is required', { email: 'user@example.com' })
            );
        }

        if (typeof email !== 'string') {
            return res.status(400).json(
                ResponseUtils.validationError('Email must be a string')
            );
        }

        
        const result = await emailValidator.validateSingle(email);
        res.json(result);

    } catch (error) {
        console.error('Validation error:', error);
        res.status(500).json(
            ResponseUtils.serverError('Internal server error during email validation', error)
        );
    }
});

router.post('/validate-emails', async (req, res) => {
    const requestId = ResponseUtils.generateRequestId();
    try {
        const { emails } = req.body;

        if (!emails || !Array.isArray(emails)) {
            return res.status(400).json(
                ResponseUtils.validationError('Emails array is required', 
                    { emails: ['user1@example.com', 'user2@example.com'] })
            );
        }

        const uniqueEmails = emailValidator.removeDuplicates(emails);
        const duplicatesRemoved = emails.length - uniqueEmails.length;

        if (duplicatesRemoved > 0) {
            console.log(`[${requestId}] Removed ${duplicatesRemoved} duplicate emails`);
        }

        const results = await emailValidator.validateBatch(uniqueEmails, requestId);
        const statistics = emailValidator.calculateStatistics(results);
        const processingInfo = ResponseUtils.createProcessingInfo(emails.length, duplicatesRemoved, results.length);

        res.json(ResponseUtils.batchValidationSuccess(results, statistics, processingInfo));

    } catch (error) {
        console.error(`[${requestId}] Batch validation error:`, error);
        res.status(500).json(
            ResponseUtils.serverError('Internal server error during batch validation', error)
        );
    }
});

module.exports = router;