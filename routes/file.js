const express = require('express');
const EmailValidationService = require('../services/EmailValidationService');
const ResponseUtils = require('../utils/responseUtils');
const FileUtils = require('../utils/fileUtils');
const { uploadMiddleware } = require('../middleware');

const router = express.Router();
const emailValidator = new EmailValidationService();

router.post('/validate-csv', uploadMiddleware.single('csvfile'), async (req, res) => {
    const requestId = ResponseUtils.generateRequestId();
    try {
        if (!req.file) {
            return res.status(400).json(
                ResponseUtils.validationError('CSV file is required', 'Upload a CSV file with email column')
            );
        }

        const emails = await FileUtils.parseCSVEmails(req.file.path);
        FileUtils.cleanupFile(req.file.path);

        if (emails.length === 0) {
            return res.status(400).json(
                ResponseUtils.validationError('No valid emails found in CSV file')
            );
        }

        const uniqueEmails = emailValidator.removeDuplicates(emails);
        const duplicatesRemoved = emails.length - uniqueEmails.length;

        if (duplicatesRemoved > 0) {
            console.log(`[${requestId}] CSV: Removed ${duplicatesRemoved} duplicate emails`);
        }

        const results = await emailValidator.validateBatch(uniqueEmails, requestId);
        const statistics = emailValidator.calculateStatistics(results);
        const processingInfo = ResponseUtils.createProcessingInfo(emails.length, duplicatesRemoved, results.length);

        res.json(ResponseUtils.csvUploadSuccess(results, statistics, processingInfo, req.file.originalname));

    } catch (error) {
        FileUtils.cleanupFile(req.file?.path);
        console.error(`[${requestId}] CSV validation error:`, error);
        res.status(500).json(
            ResponseUtils.serverError('Error processing CSV file', error)
        );
    }
});

router.post('/validate-csv-and-export', uploadMiddleware.single('csvfile'), async (req, res) => {
    const requestId = ResponseUtils.generateRequestId();
    try {
        if (!req.file) {
            return res.status(400).json(
                ResponseUtils.validationError('CSV file is required', 'Upload a CSV file with email column')
            );
        }

        const emails = await FileUtils.parseCSVEmails(req.file.path);
        FileUtils.cleanupFile(req.file.path);

        if (emails.length === 0) {
            return res.status(400).json(
                ResponseUtils.validationError('No valid emails found in CSV file')
            );
        }

        const uniqueEmails = emailValidator.removeDuplicates(emails);
        const duplicatesRemoved = emails.length - uniqueEmails.length;

        if (duplicatesRemoved > 0) {
            console.log(`[${requestId}] CSV Export: Removed ${duplicatesRemoved} duplicate emails`);
        }

        const results = await emailValidator.validateBatch(uniqueEmails, requestId);
        const csvContent = FileUtils.generateCSV(results);
        const filename = FileUtils.generateFilename(req.file.originalname, 'validation-results', '.csv');
        const headers = FileUtils.createCSVExportHeaders(results, emails.length, duplicatesRemoved);

        ResponseUtils.setFileDownloadHeaders(res, filename, 'text/csv', headers);
        res.send(csvContent);

    } catch (error) {
        FileUtils.cleanupFile(req.file?.path);
        console.error(`[${requestId}] CSV Export validation error:`, error);
        res.status(500).json(
            ResponseUtils.serverError('Error processing CSV file for export', error)
        );
    }
});

router.post('/validate-excel', uploadMiddleware.single('excelfile'), async (req, res) => {
    const requestId = ResponseUtils.generateRequestId();
    try {
        if (!req.file) {
            return res.status(400).json(
                ResponseUtils.validationError('Excel file is required', 'Upload an Excel file with email column')
            );
        }

        const excelData = FileUtils.parseExcelData(req.file.path);
        FileUtils.cleanupFile(req.file.path);

        if (excelData.length === 0) {
            return res.status(400).json(
                ResponseUtils.validationError('No valid emails found in Excel file')
            );
        }

        console.log(`[${requestId}] Excel: Processing ${excelData.length} rows`);
        console.log(`[${requestId}] Sample data:`, excelData.slice(0, 2));

        const results = await emailValidator.validateExcelData(excelData, requestId);
        const statistics = ResponseUtils.createValidationStatistics(results);
        const excelBuffer = FileUtils.generateExcel(results);
        const filename = FileUtils.generateFilename(req.file.originalname, 'validation-results', '.xlsx');
        const headers = FileUtils.createExcelExportHeaders(results);

        ResponseUtils.setFileDownloadHeaders(res, filename, 
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', headers);
        res.send(excelBuffer);

    } catch (error) {
        FileUtils.cleanupFile(req.file?.path);
        console.error(`[${requestId}] Excel validation error:`, error);
        res.status(500).json(
            ResponseUtils.serverError('Error processing Excel file', error)
        );
    }
});

module.exports = router;