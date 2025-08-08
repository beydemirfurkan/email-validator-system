const multer = require('multer');
const crypto = require('crypto');
const fs = require('fs');
const config = require('./config');

function corsMiddleware(req, res, next) {
    res.header('Access-Control-Allow-Origin', config.cors.origin);
    res.header('Access-Control-Allow-Headers', config.cors.headers);
    res.header('Access-Control-Allow-Methods', config.cors.methods);
    next();
}

const uploadMiddleware = multer({
    dest: config.upload.tempDir,
    filename: (req, file, cb) => {
        const uniqueId = crypto.randomUUID();
        const timestamp = Date.now();
        cb(null, `${timestamp}-${uniqueId}-${file.originalname}`);
    },
    fileFilter: (req, file, cb) => {
        if (config.upload.allowedTypes.includes(file.mimetype) || 
            config.upload.allowedExtensions.some(ext => file.originalname.toLowerCase().endsWith(ext))) {
            cb(null, true);
        } else {
            cb(new Error('Only CSV and Excel files are allowed'), false);
        }
    },
    limits: {
        fileSize: config.upload.maxFileSize
    }
});

function notFoundHandler(req, res) {
    res.status(404).json({
        success: false,
        error: 'Endpoint not found',
        available_endpoints: [
            'POST /api/validate-email',
            'POST /api/validate-emails',
            'POST /api/validate-csv',
            'POST /api/validate-csv-and-export',
            'POST /api/validate-excel',
            'POST /api/export-csv',
            'GET /api/health'
        ]
    });
}

function errorHandler(error, req, res, next) {
    console.error('Unhandled error:', error);
    
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(413).json({
                success: false,
                error: 'File too large',
                message: 'Maximum file size is 100MB'
            });
        }
        return res.status(400).json({
            success: false,
            error: 'File upload error',
            message: error.message
        });
    }
    
    if (error.message === 'Only CSV and Excel files are allowed') {
        return res.status(400).json({
            success: false,
            error: 'Invalid file type',
            message: 'Only CSV and Excel files (.csv, .xls, .xlsx) are allowed'
        });
    }
    
    res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error.message
    });
}

function requestLogger(req, res, next) {
    const timestamp = new Date().toISOString();
    const method = req.method;
    const url = req.url;
    const ip = req.ip || req.connection.remoteAddress;
    
    console.log(`[${timestamp}] ${method} ${url} - ${ip}`);
    next();
}

function initializeTempDirectory() {
    if (!fs.existsSync(config.upload.tempDir)) {
        fs.mkdirSync(config.upload.tempDir, { recursive: true });
        console.log('Created temp directory for file uploads');
    }
}

module.exports = {
    corsMiddleware,
    uploadMiddleware,
    notFoundHandler,
    errorHandler,
    requestLogger,
    initializeTempDirectory
};