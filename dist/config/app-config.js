"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.appConfig = void 0;
exports.appConfig = {
    server: {
        port: parseInt(process.env.PORT || '4444'),
        jsonLimit: '50mb',
        urlencodedLimit: '50mb'
    },
    validation: {
        batchSize: 10
    },
    upload: {
        tempDir: 'temp/',
        maxFileSize: 100 * 1024 * 1024,
        allowedTypes: [
            'text/csv',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        ],
        allowedExtensions: ['.csv', '.xls', '.xlsx']
    },
    csv: {
        emailColumns: ['email', 'Email', 'EMAIL', 'e-mail', 'E-mail', 'mail']
    },
    cors: {
        origin: '*',
        headers: 'Origin, X-Requested-With, Content-Type, Accept',
        methods: 'GET, POST, OPTIONS'
    },
    database: {
        url: process.env.DATABASE_URL || 'postgresql://localhost:5432/email_validator'
    }
};
//# sourceMappingURL=app-config.js.map