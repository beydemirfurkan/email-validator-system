"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const app_config_1 = require("./config/app-config");
const security_middleware_1 = require("./middleware/security.middleware");
const email_validation_routes_1 = require("./routes/email-validation.routes");
const auth_routes_1 = require("./routes/auth.routes");
const file_upload_routes_1 = require("./routes/file-upload.routes");
const api_keys_routes_1 = require("./routes/api-keys.routes");
const contact_lists_routes_1 = require("./routes/contact-lists.routes");
const contacts_routes_1 = require("./routes/contacts.routes");
const plans_routes_1 = require("./routes/plans.routes");
const analytics_routes_1 = require("./routes/analytics.routes");
const debug_routes_1 = require("./routes/debug.routes");
const response_utils_1 = require("./utils/response.utils");
const debug_utils_1 = require("./utils/debug.utils");
const app = (0, express_1.default)();
app.use((0, cors_1.default)({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || false,
    credentials: true,
    optionsSuccessStatus: 200,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
    exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset']
}));
app.use(security_middleware_1.SecurityMiddleware.helmet());
app.use(security_middleware_1.SecurityMiddleware.additionalHeaders());
app.use(express_1.default.json({
    limit: app_config_1.appConfig.server.jsonLimit,
    type: 'application/json'
}));
app.use(express_1.default.urlencoded({
    extended: true,
    limit: app_config_1.appConfig.server.urlencodedLimit,
    type: 'application/x-www-form-urlencoded'
}));
app.use(debug_utils_1.DebugUtils.requestLogger());
app.use(debug_utils_1.DebugUtils.errorTracker());
app.use('/api', email_validation_routes_1.emailValidationRoutes);
app.use('/api/auth', auth_routes_1.authRoutes);
app.use('/api/files', file_upload_routes_1.fileUploadRoutes);
app.use('/api/keys', api_keys_routes_1.apiKeysRoutes);
app.use('/api/contact-lists', contact_lists_routes_1.contactListsRoutes);
app.use('/api/contacts', contacts_routes_1.contactsRoutes);
app.use('/api/plans', plans_routes_1.plansRoutes);
app.use('/api/analytics', analytics_routes_1.analyticsRoutes);
app.use('/api/debug', debug_routes_1.debugRoutes);
app.get('/', (req, res) => {
    res.json(response_utils_1.ResponseUtils.success({
        name: 'Email Validator API',
        version: '2.0.0',
        description: 'Professional email validation API with Upstash Redis cache and Helmet.js security',
        cache: 'upstash-redis',
        security: 'helmet.js',
        endpoints: {
            health: 'GET /api/health',
            validateEmail: 'POST /api/validate-email',
            validateBatch: 'POST /api/validate-emails',
            register: 'POST /api/auth/register',
            login: 'POST /api/auth/login',
            profile: 'GET /api/auth/profile',
            uploadCSV: 'POST /api/files/validate-csv',
            uploadExcel: 'POST /api/files/validate-excel',
            checkStatus: 'GET /api/files/status/:requestId',
            listKeys: 'GET /api/keys',
            createKey: 'POST /api/keys',
            updateKey: 'PUT /api/keys/:id',
            deleteKey: 'DELETE /api/keys/:id',
            contactLists: 'GET /api/contact-lists',
            createContactList: 'POST /api/contact-lists',
            listContacts: 'GET /api/contacts/lists/:listId/contacts',
            addContact: 'POST /api/contacts/lists/:listId/contacts',
            bulkImport: 'POST /api/contacts/bulk-import',
            plans: 'GET /api/plans',
            subscribe: 'POST /api/plans/:id/subscribe',
            subscription: 'GET /api/plans/subscriptions',
            usage: 'GET /api/plans/usage',
            dashboard: 'GET /api/analytics/dashboard',
            validationLogs: 'GET /api/analytics/validation-logs',
            topDomains: 'GET /api/analytics/top-domains',
            systemStats: 'GET /api/analytics/system-stats',
            systemHealth: 'GET /api/debug/system-health',
            requestMetrics: 'GET /api/debug/request-metrics',
            memoryStats: 'GET /api/debug/memory-stats',
            databaseStats: 'GET /api/debug/database-stats'
        }
    }));
});
app.use((req, res) => {
    res.status(404).json(response_utils_1.ResponseUtils.error('Endpoint not found', 404));
});
app.use((error, req, res, next) => {
    console.error('Unhandled error:', error);
    const message = process.env.NODE_ENV === 'production'
        ? 'Internal server error'
        : error.message;
    res.status(500).json(response_utils_1.ResponseUtils.serverError(message, error));
});
const PORT = app_config_1.appConfig.server.port;
app.listen(PORT, () => {
    console.log(`🚀 Email Validator API v2.0.0 running on port ${PORT}`);
    console.log(`🔒 Security: Helmet.js enabled`);
    console.log(`📦 Cache: Upstash Redis integration`);
    console.log(`📍 Health check: http://localhost:${PORT}/api/health`);
    console.log(`📧 Single validation: POST http://localhost:${PORT}/api/validate-email`);
    console.log(`📦 Batch validation: POST http://localhost:${PORT}/api/validate-emails`);
});
exports.default = app;
//# sourceMappingURL=app.js.map