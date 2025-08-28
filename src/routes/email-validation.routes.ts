import { Router, Request, Response } from 'express';
import { EmailValidationService } from '../services/email-validation.service';
import { UsageTrackingService } from '../services/usage-tracking.service';
import { ResponseUtils } from '../utils/response.utils';
import { emailValidationSchema, batchEmailValidationSchema } from '../types/validation';
import { AuthMiddleware } from '../middleware/auth.middleware';
import { ZodError } from 'zod';

const router = Router();
const emailValidator = new EmailValidationService();
const usageTracker = new UsageTrackingService();

// Single email validation endpoint
router.post('/validate-email', AuthMiddleware.authenticateToken, async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    const validatedData = emailValidationSchema.parse(req.body);
    const { email } = validatedData;

    // Ensure the user has an active usage quota
    if (req.user?.id) {
      await usageTracker.ensureUsageQuota(req.user.id);
    }

    // Check if user has available validations
    if (req.user?.id) {
      const quotaCheck = await usageTracker.checkValidationQuota(req.user.id);
      if (!quotaCheck.canValidate) {
        return res.status(429).json(
          ResponseUtils.error(quotaCheck.message || 'Validation quota exceeded', 429)
        );
      }
    }

    const result = await emailValidator.validateSingle(email);
    const processingTime = Date.now() - startTime;

    // Add processing time to result
    result.processingTime = processingTime;

    // Track usage and log validation
    if (req.user?.id) {
      const usageIncremented = await usageTracker.incrementValidationUsage(req.user.id, req.apiKey?.id);
      if (!usageIncremented) {
        console.error('Failed to increment usage for user:', req.user.id);
      }

      // Log the validation
      await usageTracker.logValidation(
        req.user.id,
        email,
        result,
        processingTime,
        req.ip || null,
        req.headers['user-agent'] || undefined,
        req.apiKey?.id
      );
    }

    return res.json(ResponseUtils.success(result));
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json(
        ResponseUtils.validationError(
          error.errors.map(e => e.message).join(', '),
          'user@example.com'
        )
      );
    }

    console.error('Email validation error:', error);
    return res.status(500).json(
      ResponseUtils.serverError('Internal server error', error as Error)
    );
  }
});

// Batch email validation endpoint
router.post('/validate-emails', AuthMiddleware.authenticateToken, async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    const validatedData = batchEmailValidationSchema.parse(req.body);
    const { emails } = validatedData;

    // Remove duplicates
    const uniqueEmails = emailValidator.removeDuplicates(emails);
    const duplicatesRemoved = emails.length - uniqueEmails.length;

    // Ensure the user has an active usage quota
    if (req.user?.id) {
      await usageTracker.ensureUsageQuota(req.user.id);
    }

    // Check if user has enough validations for the batch
    if (req.user?.id) {
      const quotaCheck = await usageTracker.checkValidationQuota(req.user.id);
      if (!quotaCheck.canValidate) {
        return res.status(429).json(
          ResponseUtils.error(quotaCheck.message || 'Validation quota exceeded', 429)
        );
      }

      const remainingValidations = quotaCheck.validationsLimit - quotaCheck.validationsUsed;
      if (uniqueEmails.length > remainingValidations) {
        return res.status(429).json(
          ResponseUtils.error(
            `Batch size (${uniqueEmails.length}) exceeds remaining validation quota (${remainingValidations})`,
            429
          )
        );
      }
    }

    // Validate batch
    const results = await emailValidator.validateBatch(uniqueEmails);
    const processingTime = Date.now() - startTime;

    // Calculate statistics
    const statistics = emailValidator.calculateStatistics(results);
    const processingInfo = ResponseUtils.createProcessingInfo(
      emails.length,
      duplicatesRemoved,
      uniqueEmails.length
    );

    // Track usage for each validation in the batch
    if (req.user?.id) {
      for (let i = 0; i < uniqueEmails.length; i++) {
        const email = uniqueEmails[i];
        const result = results[i];
        
        if (!email) continue; // Skip if email is undefined
        
        const usageIncremented = await usageTracker.incrementValidationUsage(req.user.id, req.apiKey?.id);
        if (!usageIncremented) {
          console.error('Failed to increment usage for user:', req.user.id);
        }

        // Log each validation
        await usageTracker.logValidation(
          req.user.id,
          email,
          result,
          processingTime / uniqueEmails.length, // Average processing time per email
          req.ip || null,
          req.headers['user-agent'] || undefined,
          req.apiKey?.id
        );
      }
    }

    return res.json(ResponseUtils.batchValidationSuccess(results, {
      total: statistics.total,
      valid: statistics.valid,
      invalid: statistics.invalid,
      validPercentage: statistics.validPercentage.toString(),
      invalidPercentage: statistics.invalidPercentage.toString()
    }, processingInfo));
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json(
        ResponseUtils.validationError(
          error.errors.map(e => e.message).join(', '),
          '["user1@example.com", "user2@example.com"]'
        )
      );
    }

    console.error('Batch validation error:', error);
    return res.status(500).json(
      ResponseUtils.serverError('Internal server error', error as Error)
    );
  }
});

// Health check endpoint
router.get('/health', (req: Request, res: Response) => {
  const cacheStats = emailValidator.getCacheStatistics();
  
  return res.json(ResponseUtils.success({
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

export { router as emailValidationRoutes };