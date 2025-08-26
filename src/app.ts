import express from 'express';
import cors from 'cors';
import { appConfig } from './config/app-config';
import { emailValidationRoutes } from './routes/email-validation.routes';
import { authRoutes } from './routes/auth.routes';
import { fileUploadRoutes } from './routes/file-upload.routes';
import { apiKeysRoutes } from './routes/api-keys.routes';
import { contactListsRoutes } from './routes/contact-lists.routes';
import { contactsRoutes } from './routes/contacts.routes';
import { plansRoutes } from './routes/plans.routes';
import { analyticsRoutes } from './routes/analytics.routes';
import { debugRoutes } from './routes/debug.routes';
import { ResponseUtils } from './utils/response.utils';
import { DebugUtils } from './utils/debug.utils';

const app = express();

// Middleware
app.use(cors(appConfig.cors));
app.use(express.json({ limit: appConfig.server.jsonLimit }));
app.use(express.urlencoded({ extended: true, limit: appConfig.server.urlencodedLimit }));

// Debug and monitoring middleware
app.use(DebugUtils.requestLogger());
app.use(DebugUtils.errorTracker());

// Routes
app.use('/api', emailValidationRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/files', fileUploadRoutes);
app.use('/api/keys', apiKeysRoutes);
app.use('/api/contact-lists', contactListsRoutes);
app.use('/api/contacts', contactsRoutes);
app.use('/api/plans', plansRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/debug', debugRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json(ResponseUtils.success({
    name: 'Email Validator API',
    version: '2.0.0',
    description: 'Professional email validation API with TypeScript, Drizzle ORM, and Zod validation',
    endpoints: {
      // Health & Validation
      health: 'GET /api/health',
      validateEmail: 'POST /api/validate-email',
      validateBatch: 'POST /api/validate-emails',
      
      // Authentication
      register: 'POST /api/auth/register',
      login: 'POST /api/auth/login',
      profile: 'GET /api/auth/profile',
      
      // File Processing
      uploadCSV: 'POST /api/files/validate-csv',
      uploadExcel: 'POST /api/files/validate-excel',
      checkStatus: 'GET /api/files/status/:requestId',
      
      // API Keys
      listKeys: 'GET /api/keys',
      createKey: 'POST /api/keys',
      updateKey: 'PUT /api/keys/:id',
      deleteKey: 'DELETE /api/keys/:id',
      
      // Contact Management
      contactLists: 'GET /api/contact-lists',
      createContactList: 'POST /api/contact-lists',
      listContacts: 'GET /api/contacts/lists/:listId/contacts',
      addContact: 'POST /api/contacts/lists/:listId/contacts',
      bulkImport: 'POST /api/contacts/bulk-import',
      
      // Plans & Subscriptions
      plans: 'GET /api/plans',
      subscribe: 'POST /api/plans/:id/subscribe',
      subscription: 'GET /api/plans/subscriptions',
      usage: 'GET /api/plans/usage',
      
      // Analytics
      dashboard: 'GET /api/analytics/dashboard',
      validationLogs: 'GET /api/analytics/validation-logs',
      topDomains: 'GET /api/analytics/top-domains',
      systemStats: 'GET /api/analytics/system-stats',
      
      // Debug & Monitoring
      systemHealth: 'GET /api/debug/system-health',
      requestMetrics: 'GET /api/debug/request-metrics',
      memoryStats: 'GET /api/debug/memory-stats',
      databaseStats: 'GET /api/debug/database-stats'
    }
  }));
});

// 404 handler
app.use((req, res) => {
  res.status(404).json(ResponseUtils.error('Endpoint not found', 404));
});

// Global error handler
app.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', error);
  res.status(500).json(ResponseUtils.serverError('Internal server error', error));
});

// Start server
const PORT = appConfig.server.port;
app.listen(PORT, () => {
  console.log(`🚀 Email Validator API v2.0.0 running on port ${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/api/health`);
  console.log(`📧 Single validation: POST http://localhost:${PORT}/api/validate-email`);
  console.log(`📦 Batch validation: POST http://localhost:${PORT}/api/validate-emails`);
});

export default app;