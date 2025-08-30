export const appConfig = {
  server: {
    port: parseInt(process.env.PORT || '4444'),
    jsonLimit: '50mb',
    urlencodedLimit: '50mb'
  },
  
  validation: {
    batchSize: 10,
    enableSmtpValidation: process.env.ENABLE_SMTP_VALIDATION === 'true'
  },

  smtp: {
    // HELO domains pool - rotated for better deliverability
    heloDomains: (process.env.SMTP_HELO_DOMAINS || 'mail.example.com,smtp.example.com,relay.example.com').split(','),
    
    // FROM addresses pool - rotated to avoid rate limiting
    fromAddresses: (process.env.SMTP_FROM_ADDRESSES || 'verify@example.com,test@example.com,check@example.com').split(','),
    
    // Connection settings
    connectTimeout: parseInt(process.env.SMTP_CONNECT_TIMEOUT || '15000'),
    readTimeout: parseInt(process.env.SMTP_READ_TIMEOUT || '15000'),
    maxRetries: parseInt(process.env.SMTP_MAX_RETRIES || '2'),
    
    // Connection pooling
    maxConnectionsPerPool: parseInt(process.env.SMTP_MAX_CONNECTIONS_PER_POOL || '3'),
    maxIdleTime: parseInt(process.env.SMTP_MAX_IDLE_TIME || '60000'),
    
    // Behavior settings
    enableConnectionPooling: process.env.SMTP_ENABLE_POOLING !== 'false',
    starttls: (process.env.SMTP_STARTTLS || 'auto') as 'on' | 'off' | 'auto',
    verbose: process.env.SMTP_VERBOSE === 'true'
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
    url: process.env.DATABASE_URL || 'postgresql://localhost:5432/email_validator'
  }
} as const;