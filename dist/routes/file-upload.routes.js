"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fileUploadRoutes = void 0;
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const uuid_1 = require("uuid");
const auth_middleware_1 = require("../middleware/auth.middleware");
const rate_limiter_middleware_1 = require("../middleware/rate-limiter.middleware");
const response_utils_1 = require("../utils/response.utils");
const file_utils_1 = require("../utils/file.utils");
const background_processor_service_1 = require("../services/background-processor.service");
const app_config_1 = require("../config/app-config");
const router = (0, express_1.Router)();
exports.fileUploadRoutes = router;
const storage = multer_1.default.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path_1.default.join(process.cwd(), app_config_1.appConfig.upload.tempDir);
        if (!fs_1.default.existsSync(uploadDir)) {
            fs_1.default.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueName = `${Date.now()}-${(0, uuid_1.v4)()}${path_1.default.extname(file.originalname)}`;
        cb(null, uniqueName);
    }
});
const upload = (0, multer_1.default)({
    storage,
    limits: {
        fileSize: app_config_1.appConfig.upload.maxFileSize,
        files: 1
    },
    fileFilter: (req, file, cb) => {
        if (!app_config_1.appConfig.upload.allowedTypes.includes(file.mimetype)) {
            return cb(new Error('Invalid file type. Only CSV and Excel files are allowed.'));
        }
        const ext = path_1.default.extname(file.originalname).toLowerCase();
        if (!app_config_1.appConfig.upload.allowedExtensions.includes(ext)) {
            return cb(new Error('Invalid file extension. Only .csv, .xls, .xlsx files are allowed.'));
        }
        cb(null, true);
    }
});
const fileUploadLimiter = rate_limiter_middleware_1.RateLimiterMiddleware.create({
    maxRequests: 10,
    windowMs: 60 * 60 * 1000,
    message: 'Too many file uploads, please try again later',
    keyGenerator: (req) => req.user ? `upload:user:${req.user.id}` : `upload:ip:${req.ip}`
});
router.post('/validate-csv', auth_middleware_1.AuthMiddleware.optionalAuth, fileUploadLimiter, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json(response_utils_1.ResponseUtils.validationError('No file uploaded. Please select a CSV file.'));
        }
        const { immediate = 'false' } = req.body;
        const shouldProcessImmediately = immediate === 'true';
        const requestId = response_utils_1.ResponseUtils.generateRequestId();
        const filePath = req.file.path;
        const originalFilename = req.file.originalname;
        console.log(`[${requestId}] CSV upload: ${originalFilename} (${req.file.size} bytes)`);
        if (shouldProcessImmediately) {
            try {
                const emails = await file_utils_1.FileUtils.parseCSVEmails(filePath);
                file_utils_1.FileUtils.cleanupFile(filePath);
                if (emails.length === 0) {
                    return res.status(400).json(response_utils_1.ResponseUtils.validationError('No valid emails found in the CSV file'));
                }
                const { EmailValidationService } = await Promise.resolve().then(() => __importStar(require('../services/email-validation.service')));
                const emailValidator = new EmailValidationService();
                const uniqueEmails = emailValidator.removeDuplicates(emails);
                const duplicatesRemoved = emails.length - uniqueEmails.length;
                const results = await emailValidator.validateBatch(uniqueEmails, requestId);
                const statistics = response_utils_1.ResponseUtils.createValidationStatistics(results);
                const processingInfo = response_utils_1.ResponseUtils.createProcessingInfo(emails.length, duplicatesRemoved, uniqueEmails.length);
                const exportHeaders = file_utils_1.FileUtils.createCSVExportHeaders(results, emails.length, duplicatesRemoved);
                Object.entries(exportHeaders).forEach(([key, value]) => {
                    res.setHeader(key, value.toString());
                });
                return res.json(response_utils_1.ResponseUtils.csvUploadSuccess(results, statistics, processingInfo, originalFilename));
            }
            catch (error) {
                file_utils_1.FileUtils.cleanupFile(filePath);
                throw error;
            }
        }
        else {
            background_processor_service_1.backgroundProcessor.queueCSVProcessing(filePath, originalFilename, requestId);
            return res.json(response_utils_1.ResponseUtils.success({
                message: 'CSV file uploaded successfully and queued for processing',
                requestId,
                filename: originalFilename,
                status: 'processing',
                statusUrl: `/api/files/status/${requestId}`,
                estimatedTime: `${Math.ceil(req.file.size / (1024 * 100))} minutes`
            }));
        }
    }
    catch (error) {
        if (req.file) {
            file_utils_1.FileUtils.cleanupFile(req.file.path);
        }
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json(response_utils_1.ResponseUtils.validationError('File too large. Maximum size is 100MB.'));
        }
        console.error('CSV upload error:', error);
        return res.status(500).json(response_utils_1.ResponseUtils.serverError('CSV upload failed', error));
    }
});
router.post('/validate-excel', auth_middleware_1.AuthMiddleware.optionalAuth, fileUploadLimiter, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json(response_utils_1.ResponseUtils.validationError('No file uploaded. Please select an Excel file.'));
        }
        const { immediate = 'false' } = req.body;
        const shouldProcessImmediately = immediate === 'true';
        const requestId = response_utils_1.ResponseUtils.generateRequestId();
        const filePath = req.file.path;
        const originalFilename = req.file.originalname;
        console.log(`[${requestId}] Excel upload: ${originalFilename} (${req.file.size} bytes)`);
        if (shouldProcessImmediately) {
            try {
                const excelData = file_utils_1.FileUtils.parseExcelData(filePath);
                file_utils_1.FileUtils.cleanupFile(filePath);
                if (excelData.length === 0) {
                    return res.status(400).json(response_utils_1.ResponseUtils.validationError('No valid data found in the Excel file'));
                }
                const { BackgroundProcessor } = await Promise.resolve().then(() => __importStar(require('../services/background-processor.service')));
                const processor = new BackgroundProcessor();
                const results = await processor['validateExcelData'](excelData, requestId);
                const statistics = response_utils_1.ResponseUtils.createValidationStatistics(results);
                const exportHeaders = file_utils_1.FileUtils.createExcelExportHeaders(results);
                Object.entries(exportHeaders).forEach(([key, value]) => {
                    res.setHeader(key, value.toString());
                });
                return res.json(response_utils_1.ResponseUtils.success({
                    source: 'excel_upload',
                    filename: originalFilename,
                    results,
                    statistics,
                    export_info: {
                        message: "Use POST /api/files/export-excel with the 'results' array to download Excel",
                        total_results: results.length
                    }
                }));
            }
            catch (error) {
                file_utils_1.FileUtils.cleanupFile(filePath);
                throw error;
            }
        }
        else {
            background_processor_service_1.backgroundProcessor.queueExcelProcessing(filePath, originalFilename, requestId);
            return res.json(response_utils_1.ResponseUtils.success({
                message: 'Excel file uploaded successfully and queued for processing',
                requestId,
                filename: originalFilename,
                status: 'processing',
                statusUrl: `/api/files/status/${requestId}`,
                estimatedTime: `${Math.ceil(req.file.size / (1024 * 100))} minutes`
            }));
        }
    }
    catch (error) {
        if (req.file) {
            file_utils_1.FileUtils.cleanupFile(req.file.path);
        }
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json(response_utils_1.ResponseUtils.validationError('File too large. Maximum size is 100MB.'));
        }
        console.error('Excel upload error:', error);
        return res.status(500).json(response_utils_1.ResponseUtils.serverError('Excel upload failed', error));
    }
});
router.get('/status/:requestId', async (req, res) => {
    try {
        const { requestId } = req.params;
        if (!requestId || typeof requestId !== 'string') {
            return res.status(400).json(response_utils_1.ResponseUtils.validationError('Request ID is required'));
        }
        const status = background_processor_service_1.backgroundProcessor.getQueueStatus();
        const job = status.jobs.find(j => j.id === requestId);
        if (!job) {
            return res.status(404).json(response_utils_1.ResponseUtils.error('Processing job not found. It may have completed or expired.', 404));
        }
        return res.json(response_utils_1.ResponseUtils.success({
            requestId,
            status: 'processing',
            filename: job.filename,
            type: job.type,
            startTime: job.startTime,
            message: 'File is being processed. Please check back later.',
            estimatedCompletion: new Date(job.startTime.getTime() + 10 * 60 * 1000)
        }));
    }
    catch (error) {
        console.error('Status check error:', error);
        return res.status(500).json(response_utils_1.ResponseUtils.serverError('Failed to check status', error));
    }
});
router.post('/export-csv', async (req, res) => {
    try {
        const { results } = req.body;
        if (!results || !Array.isArray(results) || results.length === 0) {
            return res.status(400).json(response_utils_1.ResponseUtils.validationError('Results array is required and must not be empty'));
        }
        const csvContent = file_utils_1.FileUtils.generateCSV(results);
        const filename = `email-validation-results-${response_utils_1.ResponseUtils.generateTimestamp()}.csv`;
        response_utils_1.ResponseUtils.setFileDownloadHeaders(res, filename, 'text/csv; charset=utf-8');
        return res.send('\ufeff' + csvContent);
    }
    catch (error) {
        console.error('CSV export error:', error);
        return res.status(500).json(response_utils_1.ResponseUtils.serverError('CSV export failed', error));
    }
});
router.post('/export-excel', async (req, res) => {
    try {
        const { results } = req.body;
        if (!results || !Array.isArray(results) || results.length === 0) {
            return res.status(400).json(response_utils_1.ResponseUtils.validationError('Results array is required and must not be empty'));
        }
        const excelBuffer = file_utils_1.FileUtils.generateExcel(results);
        const filename = `email-validation-results-${response_utils_1.ResponseUtils.generateTimestamp()}.xlsx`;
        response_utils_1.ResponseUtils.setFileDownloadHeaders(res, filename, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        return res.send(excelBuffer);
    }
    catch (error) {
        console.error('Excel export error:', error);
        return res.status(500).json(response_utils_1.ResponseUtils.serverError('Excel export failed', error));
    }
});
router.get('/queue', auth_middleware_1.AuthMiddleware.authenticateToken, async (req, res) => {
    try {
        const queueStatus = background_processor_service_1.backgroundProcessor.getQueueStatus();
        return res.json(response_utils_1.ResponseUtils.success({
            queue: queueStatus,
            message: `Currently processing ${queueStatus.totalProcessing} file${queueStatus.totalProcessing !== 1 ? 's' : ''}`
        }));
    }
    catch (error) {
        console.error('Queue status error:', error);
        return res.status(500).json(response_utils_1.ResponseUtils.serverError('Failed to get queue status', error));
    }
});
//# sourceMappingURL=file-upload.routes.js.map