"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.backgroundProcessor = exports.BackgroundProcessor = void 0;
const email_validation_service_1 = require("./email-validation.service");
const file_utils_1 = require("../utils/file.utils");
class BackgroundProcessor {
    emailValidator;
    processingQueue = new Map();
    constructor() {
        this.emailValidator = new email_validation_service_1.EmailValidationService();
    }
    async processCSVFile(filePath, originalFilename, requestId) {
        try {
            console.log(`[${requestId}] Starting background CSV processing for: ${originalFilename}`);
            const emails = await file_utils_1.FileUtils.parseCSVEmails(filePath);
            file_utils_1.FileUtils.cleanupFile(filePath);
            if (emails.length === 0) {
                console.log(`[${requestId}] No valid emails found in CSV file`);
                return;
            }
            const uniqueEmails = this.emailValidator.removeDuplicates(emails);
            const duplicatesRemoved = emails.length - uniqueEmails.length;
            if (duplicatesRemoved > 0) {
                console.log(`[${requestId}] CSV Background: Removed ${duplicatesRemoved} duplicate emails`);
            }
            const results = await this.emailValidator.validateBatch(uniqueEmails, requestId);
            file_utils_1.FileUtils.saveResultsToFile(results, originalFilename, 'csv');
            const logMessage = `[${requestId}] CSV background processing completed for: ${originalFilename}`;
            console.log(logMessage);
            this.processingQueue.delete(requestId);
        }
        catch (error) {
            const logMessage = `[${requestId}] CSV background processing error: ${error.message}`;
            console.error(logMessage);
            file_utils_1.FileUtils.cleanupFile(filePath);
            this.processingQueue.delete(requestId);
        }
    }
    async processExcelFile(filePath, originalFilename, requestId) {
        try {
            console.log(`[${requestId}] Starting background Excel processing for: ${originalFilename}`);
            const excelData = file_utils_1.FileUtils.parseExcelData(filePath);
            file_utils_1.FileUtils.cleanupFile(filePath);
            if (excelData.length === 0) {
                console.log(`[${requestId}] No valid emails found in Excel file`);
                return;
            }
            console.log(`[${requestId}] Excel Background: Processing ${excelData.length} rows`);
            const results = await this.validateExcelData(excelData, requestId);
            file_utils_1.FileUtils.saveResultsToFile(results, originalFilename, 'xlsx');
            console.log(`[${requestId}] Excel background processing completed for: ${originalFilename}`);
            this.processingQueue.delete(requestId);
        }
        catch (error) {
            const logMessage = `[${requestId}] Excel background processing error: ${error.message}`;
            console.error(logMessage);
            file_utils_1.FileUtils.cleanupFile(filePath);
            this.processingQueue.delete(requestId);
        }
    }
    async validateExcelData(excelData, requestId) {
        const results = [];
        const logPrefix = requestId ? `[${requestId}]` : '';
        console.log(`${logPrefix} Starting Excel validation for ${excelData.length} rows`);
        for (let i = 0; i < excelData.length; i++) {
            const row = excelData[i];
            const emailField = this.findEmailInExcelRow(row);
            if (emailField) {
                const validationResult = await this.emailValidator.validateSingle(emailField);
                results.push({
                    ...row,
                    email_validation: validationResult.valid,
                    email_valid: validationResult.valid,
                    validation_reason: validationResult.reason?.join(', ') || '',
                    validation_details: validationResult.details
                });
            }
            else {
                results.push({
                    ...row,
                    email_validation: false,
                    email_valid: false,
                    validation_reason: 'No email found in row',
                    validation_details: {}
                });
            }
            if ((i + 1) % 100 === 0 || i === excelData.length - 1) {
                console.log(`${logPrefix} Excel validation progress: ${i + 1}/${excelData.length} rows`);
            }
        }
        return results;
    }
    findEmailInExcelRow(row) {
        const emailColumns = ['email', 'Email', 'EMAIL', 'e-mail', 'E-mail', 'mail'];
        for (const col of emailColumns) {
            if (row[col] && typeof row[col] === 'string' && row[col].trim()) {
                return row[col].trim();
            }
        }
        const firstKey = Object.keys(row)[0];
        return firstKey ? row[firstKey] || null : null;
    }
    queueCSVProcessing(filePath, originalFilename, requestId) {
        this.processingQueue.set(requestId, {
            type: 'csv',
            filename: originalFilename,
            startTime: new Date()
        });
        setImmediate(() => {
            this.processCSVFile(filePath, originalFilename, requestId);
        });
        return requestId;
    }
    queueExcelProcessing(filePath, originalFilename, requestId) {
        this.processingQueue.set(requestId, {
            type: 'excel',
            filename: originalFilename,
            startTime: new Date()
        });
        setImmediate(() => {
            this.processExcelFile(filePath, originalFilename, requestId);
        });
        return requestId;
    }
    getQueueStatus() {
        return {
            totalProcessing: this.processingQueue.size,
            jobs: Array.from(this.processingQueue.entries()).map(([id, job]) => ({
                id,
                type: job.type,
                filename: job.filename,
                startTime: job.startTime
            }))
        };
    }
}
exports.BackgroundProcessor = BackgroundProcessor;
exports.backgroundProcessor = new BackgroundProcessor();
//# sourceMappingURL=background-processor.service.js.map