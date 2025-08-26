import { Router, Request, Response } from 'express';
import { EmailValidationService } from '../services/email-validation.service';
import { ResponseUtils } from '../utils/response.utils';
import { emailValidationSchema, batchEmailValidationSchema } from '../types/validation';
import { ZodError } from 'zod';

const router = Router();
const emailValidator = new EmailValidationService();

// Single email validation endpoint
router.post('/validate-email', async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    const validatedData = emailValidationSchema.parse(req.body);
    const { email } = validatedData;

    const result = await emailValidator.validateSingle(email);
    const processingTime = Date.now() - startTime;

    // Add processing time to result
    result.processingTime = processingTime;

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
router.post('/validate-emails', async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    const validatedData = batchEmailValidationSchema.parse(req.body);
    const { emails } = validatedData;

    // Remove duplicates
    const uniqueEmails = emailValidator.removeDuplicates(emails);
    const duplicatesRemoved = emails.length - uniqueEmails.length;

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