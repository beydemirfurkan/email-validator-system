# Email Validator API

Professional email validation API with batch processing, CSV/Excel support, and detailed statistics.

## Features

- **Single Email Validation** - Validate individual email addresses
- **Batch Validation** - Process multiple emails at once
- **CSV/Excel Support** - Upload and validate files directly
- **Export Results** - Download validation results as CSV/Excel
- **Statistics** - Detailed validation statistics
- **Duplicate Removal** - Automatic duplicate email detection
- **Professional Logging** - Request tracking and error logging

## Quick Start

### Using Node.js
```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Start production server
npm start
```

### Using Docker
```bash
# Build and run with Docker Compose
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### Using PM2
```bash
# Install PM2 globally
npm install -g pm2

# Start with ecosystem config
pm2 start ecosystem.config.cjs

# Monitor processes
pm2 status
pm2 logs
```

## API Endpoints

### Single Email Validation
```http
POST /api/validate-email
Content-Type: application/json

{
  "email": "user@example.com"
}
```

### Batch Email Validation
```http
POST /api/validate-emails
Content-Type: application/json

{
  "emails": ["user1@example.com", "user2@example.com"]
}
```

### CSV File Upload & Validation
```http
POST /api/validate-csv
Content-Type: multipart/form-data

csvfile: [CSV file with email column]
```

### CSV Upload & Direct Export
```http
POST /api/validate-csv-and-export
Content-Type: multipart/form-data

csvfile: [CSV file] (Returns downloadable CSV)
```

### Excel File Upload & Validation
```http
POST /api/validate-excel
Content-Type: multipart/form-data

excelfile: [Excel file] (Returns downloadable Excel)
```

### Health Check
```http
GET /api/health
```

## Configuration

Default configuration in `config.js`:

- **Port**: 4444
- **File Size Limit**: 100MB
- **Supported Formats**: CSV, XLS, XLSX
- **Validation Options**: Regex, MX, Typo, Disposable checks
- **CORS**: Enabled for all origins

## File Upload Requirements

### CSV Files
- Must contain an email column (email, Email, EMAIL, e-mail, E-mail, mail)
- Supported formats: `.csv`
- Max file size: 100MB

### Excel Files
- First column should contain email addresses
- Supported formats: `.xls`, `.xlsx`
- Max file size: 100MB

## Response Format

### Single Email Response
```json
{
  "email": "user@example.com",
  "valid": true,
  "validators": {
    "regex": { "valid": true },
    "mx": { "valid": true },
    "typo": { "valid": true },
    "disposable": { "valid": true }
  }
}
```

### Batch Response
```json
{
  "success": true,
  "results": [...],
  "statistics": {
    "total": 100,
    "valid": 85,
    "invalid": 15,
    "validPercentage": 85.0
  },
  "processing": {
    "originalCount": 105,
    "duplicatesRemoved": 5,
    "processedCount": 100
  }
}
```

## Development

### Project Structure
```
├── app.js                 # Main application file
├── config.js              # Configuration settings
├── middleware.js          # Express middleware
├── routes/                # Route handlers
│   ├── index.js
│   ├── validation.js      # Email validation endpoints
│   ├── file.js           # File upload endpoints
│   └── health.js         # Health check endpoint
├── services/             # Business logic
│   └── EmailValidationService.js
├── utils/                # Utility functions
│   ├── fileUtils.js      # File processing utilities
│   └── responseUtils.js  # Response formatting utilities
├── temp/                 # Temporary file storage
└── logs/                 # Application logs
```

### Environment Variables
```bash
NODE_ENV=development    # or production
PORT=4444              # Server port
```

### Scripts
```bash
npm start              # Production server
npm run dev           # Development with nodemon
```

## Docker Deployment

### Build Image
```bash
docker build -t email-validator .
```

### Run Container
```bash
docker run -p 5555:4444 email-validator
```

### Docker Compose (Recommended)
```bash
docker-compose up -d
```

Access API at: http://localhost:5555

## PM2 Process Management

```bash
# Start application
pm2 start ecosystem.config.cjs

# View status
pm2 status

# View logs
pm2 logs email-validator-api

# Restart application
pm2 restart email-validator-api

# Stop application
pm2 stop email-validator-api
```

## Error Handling

- **400**: Bad Request (Invalid input, missing fields)
- **404**: Endpoint not found
- **413**: File too large
- **500**: Internal server error

## Security Features

- File type validation
- File size limits
- CORS configuration
- Request logging
- Non-root Docker user
- Input sanitization

## Performance

- Cluster mode support with PM2
- Docker multi-stage builds
- Memory usage monitoring
- Health checks
- Automatic restarts

## License

MIT License

## Support

For issues and feature requests, please create an issue in the project repository.