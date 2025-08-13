const EmailValidationService = require('./EmailValidationService');
const FileUtils = require('../utils/fileUtils');
const ResponseUtils = require('../utils/responseUtils');

class BackgroundProcessor {
    constructor() {
        this.emailValidator = new EmailValidationService();
        this.processingQueue = new Map();
    }

    async processCSVFile(filePath, originalFilename, requestId) {
        try {
            console.log(`[${requestId}] Starting background CSV processing for: ${originalFilename}`);
            
            const emails = await FileUtils.parseCSVEmails(filePath);
            FileUtils.cleanupFile(filePath);

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
            FileUtils.saveResultsToFile(results, originalFilename, 'csv');
            const logMessage = `[${requestId}] CSV background processing completed for: ${originalFilename}`;
            console.log(logMessage);
            this.processingQueue.delete(requestId);

        } catch (error) {
            const logMessage = `[${requestId}] CSV background processing error: ${error.message}`;
            console.error(logMessage);
            FileUtils.cleanupFile(filePath);
            this.processingQueue.delete(requestId);
        }
    }

    async processExcelFile(filePath, originalFilename, requestId) {
        try {
            console.log(`[${requestId}] Starting background Excel processing for: ${originalFilename}`);
            
            const excelData = FileUtils.parseExcelData(filePath);
            FileUtils.cleanupFile(filePath);

            if (excelData.length === 0) {
                console.log(`[${requestId}] No valid emails found in Excel file`);
                return;
            }

            console.log(`[${requestId}] Excel Background: Processing ${excelData.length} rows`);
            
            const results = await this.emailValidator.validateExcelData(excelData, requestId);
            FileUtils.saveResultsToFile(results, originalFilename, 'xlsx');
            
            console.log(`[${requestId}] Excel background processing completed for: ${originalFilename}`);
            this.processingQueue.delete(requestId);

        } catch (error) {
            const logMessage = `[${requestId}] Excel background processing error: ${error.message}`;
            console.error(logMessage);
            FileUtils.cleanupFile(filePath);
            this.processingQueue.delete(requestId);
        }
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

module.exports = new BackgroundProcessor();