"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.emailValidationRoutes = void 0;
const express_1 = require("express");
const email_validation_service_1 = require("../services/email-validation.service");
const response_utils_1 = require("../utils/response.utils");
const validation_1 = require("../types/validation");
const zod_1 = require("zod");
const router = (0, express_1.Router)();
exports.emailValidationRoutes = router;
const emailValidator = new email_validation_service_1.EmailValidationService();
router.post('/validate-email', async (req, res) => {
    const startTime = Date.now();
    try {
        const validatedData = validation_1.emailValidationSchema.parse(req.body);
        const { email } = validatedData;
        const result = await emailValidator.validateSingle(email);
        const processingTime = Date.now() - startTime;
        result.processingTime = processingTime;
        return res.json(response_utils_1.ResponseUtils.success(result));
    }
    catch (error) {
        if (error instanceof zod_1.ZodError) {
            return res.status(400).json(response_utils_1.ResponseUtils.validationError(error.errors.map(e => e.message).join(', '), 'user@example.com'));
        }
        console.error('Email validation error:', error);
        return res.status(500).json(response_utils_1.ResponseUtils.serverError('Internal server error', error));
    }
});
router.post('/validate-emails', async (req, res) => {
    const startTime = Date.now();
    try {
        const validatedData = validation_1.batchEmailValidationSchema.parse(req.body);
        const { emails } = validatedData;
        const uniqueEmails = emailValidator.removeDuplicates(emails);
        const duplicatesRemoved = emails.length - uniqueEmails.length;
        const results = await emailValidator.validateBatch(uniqueEmails);
        const processingTime = Date.now() - startTime;
        const statistics = emailValidator.calculateStatistics(results);
        const processingInfo = response_utils_1.ResponseUtils.createProcessingInfo(emails.length, duplicatesRemoved, uniqueEmails.length);
        return res.json(response_utils_1.ResponseUtils.batchValidationSuccess(results, {
            total: statistics.total,
            valid: statistics.valid,
            invalid: statistics.invalid,
            validPercentage: statistics.validPercentage.toString(),
            invalidPercentage: statistics.invalidPercentage.toString()
        }, processingInfo));
    }
    catch (error) {
        if (error instanceof zod_1.ZodError) {
            return res.status(400).json(response_utils_1.ResponseUtils.validationError(error.errors.map(e => e.message).join(', '), '["user1@example.com", "user2@example.com"]'));
        }
        console.error('Batch validation error:', error);
        return res.status(500).json(response_utils_1.ResponseUtils.serverError('Internal server error', error));
    }
});
router.get('/health', (req, res) => {
    const cacheStats = emailValidator.getCacheStatistics();
    return res.json(response_utils_1.ResponseUtils.success({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: '2.0.0',
        database: 'connected',
        cache: {
            size: cacheStats.size,
            hitRate: cacheStats.hitRate
        }
    }));
});
//# sourceMappingURL=email-validation.routes.js.map