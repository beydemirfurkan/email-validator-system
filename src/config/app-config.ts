export const appConfig = {
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
    maxFileSize: 100 * 1024 * 1024, // 100MB
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
    path: './database.sqlite'
  }
} as const;