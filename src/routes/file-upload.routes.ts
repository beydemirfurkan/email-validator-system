import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { AuthMiddleware } from '../middleware/auth.middleware';
import { RateLimiterMiddleware } from '../middleware/rate-limiter.middleware';
import { ResponseUtils } from '../utils/response.utils';
import { FileUtils } from '../utils/file.utils';
import { backgroundProcessor } from '../services/background-processor.service';
import { appConfig } from '../config/app-config';

const router = Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), appConfig.upload.tempDir);
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: appConfig.upload.maxFileSize,
    files: 1
  },
  fileFilter: (req, file, cb) => {
    // Check file type
    if (!appConfig.upload.allowedTypes.includes(file.mimetype as any)) {
      return cb(new Error('Invalid file type. Only CSV and Excel files are allowed.'));
    }

    // Check file extension
    const ext = path.extname(file.originalname).toLowerCase();
    if (!appConfig.upload.allowedExtensions.includes(ext as any)) {
      return cb(new Error('Invalid file extension. Only .csv, .xls, .xlsx files are allowed.'));
    }

    cb(null, true);
  }
});

// Rate limiter for file uploads
const fileUploadLimiter = RateLimiterMiddleware.create({
  maxRequests: 50, // 50 file uploads per hour per user
  windowMs: 60 * 60 * 1000,
  message: 'Too many file uploads, please try again later',
  keyGenerator: (req) => req.user ? `upload:user:${req.user.id}` : `upload:ip:${req.ip}`
});

// POST /api/files/validate-csv - Upload and validate CSV file
router.post('/validate-csv', 
  AuthMiddleware.optionalAuth, 
  fileUploadLimiter,
  upload.single('file'),
  async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json(
          ResponseUtils.validationError('No file uploaded. Please select a CSV file.')
        );
      }

      const { immediate = 'false' } = req.body;
      const shouldProcessImmediately = immediate === 'true';
      const requestId = ResponseUtils.generateRequestId();
      const filePath = req.file.path;
      const originalFilename = req.file.originalname;

      console.log(`[${requestId}] CSV upload: ${originalFilename} (${req.file.size} bytes)`);

      if (shouldProcessImmediately) {
        // Process immediately and return results
        try {
          const emails = await FileUtils.parseCSVEmails(filePath);
          FileUtils.cleanupFile(filePath);

          if (emails.length === 0) {
            return res.status(400).json(
              ResponseUtils.validationError('No valid emails found in the CSV file')
            );
          }

          const { EmailValidationService } = await import('../services/email-validation.service');
          const emailValidator = new EmailValidationService();
          
          const uniqueEmails = emailValidator.removeDuplicates(emails);
          const duplicatesRemoved = emails.length - uniqueEmails.length;
          const results = await emailValidator.validateBatch(uniqueEmails, requestId);
          
          const statistics = ResponseUtils.createValidationStatistics(results);
          const processingInfo = ResponseUtils.createProcessingInfo(
            emails.length,
            duplicatesRemoved,
            uniqueEmails.length
          );

          const exportHeaders = FileUtils.createCSVExportHeaders(
            results,
            emails.length,
            duplicatesRemoved
          );

          // Set export headers
          Object.entries(exportHeaders).forEach(([key, value]) => {
            res.setHeader(key, value.toString());
          });

          return res.json(ResponseUtils.csvUploadSuccess(
            results,
            statistics,
            processingInfo,
            originalFilename
          ));
        } catch (error) {
          FileUtils.cleanupFile(filePath);
          throw error;
        }
      } else {
        // Queue for background processing
        backgroundProcessor.queueCSVProcessing(filePath, originalFilename, requestId);

        return res.json(ResponseUtils.success({
          message: 'CSV file uploaded successfully and queued for processing',
          requestId,
          filename: originalFilename,
          status: 'processing',
          statusUrl: `/api/files/status/${requestId}`,
          estimatedTime: `${Math.ceil(req.file.size / (1024 * 100))} minutes` // Rough estimate
        }));
      }
    } catch (error: any) {
      // Cleanup file on error
      if (req.file) {
        FileUtils.cleanupFile(req.file.path);
      }

      if (error.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json(
          ResponseUtils.validationError('File too large. Maximum size is 100MB.')
        );
      }

      console.error('CSV upload error:', error);
      return res.status(500).json(
        ResponseUtils.serverError('CSV upload failed', error)
      );
    }
  }
);

// POST /api/files/validate-excel - Upload and validate Excel file
router.post('/validate-excel',
  AuthMiddleware.optionalAuth,
  fileUploadLimiter,
  upload.single('file'),
  async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json(
          ResponseUtils.validationError('No file uploaded. Please select an Excel file.')
        );
      }

      const { immediate = 'false' } = req.body;
      const shouldProcessImmediately = immediate === 'true';
      const requestId = ResponseUtils.generateRequestId();
      const filePath = req.file.path;
      const originalFilename = req.file.originalname;

      console.log(`[${requestId}] Excel upload: ${originalFilename} (${req.file.size} bytes)`);

      if (shouldProcessImmediately) {
        // Process immediately and return results
        try {
          const excelData = FileUtils.parseExcelData(filePath);
          FileUtils.cleanupFile(filePath);

          if (excelData.length === 0) {
            return res.status(400).json(
              ResponseUtils.validationError('No valid data found in the Excel file')
            );
          }

          const { BackgroundProcessor } = await import('../services/background-processor.service');
          const processor = new BackgroundProcessor();
          const results = await processor['validateExcelData'](excelData, requestId);

          const statistics = ResponseUtils.createValidationStatistics(results);
          const exportHeaders = FileUtils.createExcelExportHeaders(results);

          // Set export headers
          Object.entries(exportHeaders).forEach(([key, value]) => {
            res.setHeader(key, value.toString());
          });

          return res.json(ResponseUtils.success({
            source: 'excel_upload',
            filename: originalFilename,
            results,
            statistics,
            export_info: {
              message: "Use POST /api/files/export-excel with the 'results' array to download Excel",
              total_results: results.length
            }
          }));
        } catch (error) {
          FileUtils.cleanupFile(filePath);
          throw error;
        }
      } else {
        // Queue for background processing
        backgroundProcessor.queueExcelProcessing(filePath, originalFilename, requestId);

        return res.json(ResponseUtils.success({
          message: 'Excel file uploaded successfully and queued for processing',
          requestId,
          filename: originalFilename,
          status: 'processing',
          statusUrl: `/api/files/status/${requestId}`,
          estimatedTime: `${Math.ceil(req.file.size / (1024 * 100))} minutes`
        }));
      }
    } catch (error: any) {
      // Cleanup file on error
      if (req.file) {
        FileUtils.cleanupFile(req.file.path);
      }

      if (error.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json(
          ResponseUtils.validationError('File too large. Maximum size is 100MB.')
        );
      }

      console.error('Excel upload error:', error);
      return res.status(500).json(
        ResponseUtils.serverError('Excel upload failed', error)
      );
    }
  }
);

// GET /api/files/status/:requestId - Check processing status
router.get('/status/:requestId', async (req: Request, res: Response) => {
  try {
    const { requestId } = req.params;

    if (!requestId || typeof requestId !== 'string') {
      return res.status(400).json(
        ResponseUtils.validationError('Request ID is required')
      );
    }

    const status = backgroundProcessor.getQueueStatus();
    const job = status.jobs.find(j => j.id === requestId);

    if (!job) {
      return res.status(404).json(
        ResponseUtils.error('Processing job not found. It may have completed or expired.', 404)
      );
    }

    return res.json(ResponseUtils.success({
      requestId,
      status: 'processing',
      filename: job.filename,
      type: job.type,
      startTime: job.startTime,
      message: 'File is being processed. Please check back later.',
      estimatedCompletion: new Date(job.startTime.getTime() + 10 * 60 * 1000) // Estimate 10 minutes
    }));
  } catch (error) {
    console.error('Status check error:', error);
    return res.status(500).json(
      ResponseUtils.serverError('Failed to check status', error as Error)
    );
  }
});

// POST /api/files/export-csv - Export results as CSV
router.post('/export-csv', async (req: Request, res: Response) => {
  try {
    const { results } = req.body;

    if (!results || !Array.isArray(results) || results.length === 0) {
      return res.status(400).json(
        ResponseUtils.validationError('Results array is required and must not be empty')
      );
    }

    const csvContent = FileUtils.generateCSV(results);
    const filename = `email-validation-results-${ResponseUtils.generateTimestamp()}.csv`;

    ResponseUtils.setFileDownloadHeaders(res, filename, 'text/csv; charset=utf-8');
    
    // Add BOM for proper UTF-8 encoding in Excel
    return res.send('\ufeff' + csvContent);
  } catch (error) {
    console.error('CSV export error:', error);
    return res.status(500).json(
      ResponseUtils.serverError('CSV export failed', error as Error)
    );
  }
});

// POST /api/files/export-excel - Export results as Excel
router.post('/export-excel', async (req: Request, res: Response) => {
  try {
    const { results } = req.body;

    if (!results || !Array.isArray(results) || results.length === 0) {
      return res.status(400).json(
        ResponseUtils.validationError('Results array is required and must not be empty')
      );
    }

    const excelBuffer = FileUtils.generateExcel(results);
    const filename = `email-validation-results-${ResponseUtils.generateTimestamp()}.xlsx`;

    ResponseUtils.setFileDownloadHeaders(res, filename, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    
    return res.send(excelBuffer);
  } catch (error) {
    console.error('Excel export error:', error);
    return res.status(500).json(
      ResponseUtils.serverError('Excel export failed', error as Error)
    );
  }
});

// GET /api/files/queue - Get current processing queue status (admin only)
router.get('/queue', AuthMiddleware.authenticateToken, async (req: Request, res: Response) => {
  try {
    const queueStatus = backgroundProcessor.getQueueStatus();

    return res.json(ResponseUtils.success({
      queue: queueStatus,
      message: `Currently processing ${queueStatus.totalProcessing} file${queueStatus.totalProcessing !== 1 ? 's' : ''}`
    }));
  } catch (error) {
    console.error('Queue status error:', error);
    return res.status(500).json(
      ResponseUtils.serverError('Failed to get queue status', error as Error)
    );
  }
});

export { router as fileUploadRoutes };