const express = require('express');
const EmailValidationService = require('../services/EmailValidationService');
const BackgroundProcessor = require('../services/BackgroundProcessor');
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

        BackgroundProcessor.queueCSVProcessing(req.file.path, req.file.originalname, requestId);

        res.json({
            success: true,
            message: 'Dosyanız kuyruğa alındı. Doğrulama işlemi arka planda devam ediyor.',
            request_id: requestId,
            filename: req.file.originalname,
            status: 'queued',
            note: 'Sonuçlar hazır olduğunda results klasöründe bulacaksınız.'
        });

    } catch (error) {
        FileUtils.cleanupFile(req.file?.path);
        console.error(`[${requestId}] CSV queue error:`, error);
        res.status(500).json(
            ResponseUtils.serverError('Error queueing CSV file for processing', error)
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

        BackgroundProcessor.queueExcelProcessing(req.file.path, req.file.originalname, requestId);

        res.json({
            success: true,
            message: 'Dosyanız kuyruğa alındı. Doğrulama işlemi arka planda devam ediyor.',
            request_id: requestId,
            filename: req.file.originalname,
            status: 'queued',
            note: 'Sonuçlar hazır olduğunda results klasöründe bulacaksınız.'
        });

    } catch (error) {
        FileUtils.cleanupFile(req.file?.path);
        console.error(`[${requestId}] Excel queue error:`, error);
        res.status(500).json(
            ResponseUtils.serverError('Error queueing Excel file for processing', error)
        );
    }
});

module.exports = router;