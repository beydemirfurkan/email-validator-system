# Advanced Email Validator API

Professional enterprise-grade email validation API with comprehensive fraud detection, batch processing, international domain support, and detailed analytics.

## 🚀 Key Features

- **🔍 Advanced Validation Pipeline** - 9-layer validation with comprehensive fraud detection
- **🌍 International Domain Support** - Punycode conversion for international domains (münchen.de)
- **➕ Smart Plus Addressing** - Provider-specific plus addressing validation
- **🧠 AI-Powered Spam Detection** - Dynamic pattern recognition with contextual analysis
- **📊 Batch Processing** - High-performance concurrent validation
- **📂 File Processing** - CSV/Excel upload with validation results export
- **🔒 Enterprise Security** - Thread-safe, input sanitization, comprehensive logging
- **⚡ High Performance** - Intelligent caching, concurrent processing, memory optimization

## 🛡️ Validation Pipeline

Our advanced validation system processes emails through **9 comprehensive layers**:

### 1. **Email Length Validation**
- Rejects emails over 250 characters
- Prevents resource exhaustion attacks

### 2. **International Domain Processing**
- Converts international domains to Punycode (ASCII)
- `test@münchen.de` → `test@xn--mnchen-3ya.de`
- Validates but restricts non-ASCII characters in local part

### 3. **Format & Character Validation**
- RFC-compliant regex with practical restrictions
- Blocks quoted strings: `"unusual"@domain.com` ❌
- Blocks special characters: `user!name@domain.com` ❌
- Allows only: `a-zA-Z0-9._+-`

### 4. **Dynamic Suspicious Pattern Detection**
- **Repetitive Characters**: `sssssssss@gmail.com` ❌
- **Single Characters**: `x@gmail.com` ❌
- **Sequential Patterns**: `abcdef@gmail.com`, `123456@gmail.com` ❌
- **Keyboard Patterns**: `qwerty@gmail.com`, `asdfgh@gmail.com` ❌

### 5. **Smart Plus Addressing Validation**
- **Supported Providers**: Gmail, Yahoo, Outlook, iCloud
- **Restricted Providers**: AOL, Yandex, Mail.ru, ProtonMail
- Format validation: `user+tag@gmail.com` ✅, `user++tag@gmail.com` ❌

### 6. **Typo Domain Detection**
- Comprehensive typo domain database (500+ patterns)
- `furkan@g-mail.com` → Suggests `gmail.com`
- `admin@outlok.com` → Suggests `outlook.com`

### 7. **Disposable Email Detection**
- Real-time updated disposable domain list
- Blocks temporary email services
- `test@10minutemail.com` ❌

### 8. **Intelligent Spam Keyword Analysis**
- Dynamic ratio-based detection system
- **SPAM**: Single spam keyword (`admin@gmail.com` ❌)
- **SPAM**: All spam keywords (`test@fake-demo.com` ❌)
- **VALID**: Mixed keywords (`contact@company-service.de` ✅)
- Smart business context recognition

### 9. **MX Record Validation**
- DNS lookup with intelligent caching
- Fallback to A records
- TTL-based cache (5min success, 1min failure)

## 📋 Spam Keyword Categories

Our dynamic spam detection uses comprehensive keyword database:

- **Core Spam**: spam, fake, temp, throwaway, junk, dummy, invalid
- **System Accounts**: admin, noreply, bounce, daemon, automated
- **Test Patterns**: test, demo, sample, placeholder, testing
- **Development**: debug, dev, staging, beta, prototype
- **Generic Placeholders**: null, undefined, empty, default
- **Fake Names**: johndoe, janedoe, johnsmith, janesmith

## 🔧 Quick Start

### Node.js
```bash
# Install dependencies
npm install

# Development mode with hot reload
npm run dev

# Production mode
npm start
```

### Docker
```bash
# Build and run with Docker Compose
docker-compose up -d

# Access API at: http://localhost:5555
```

### PM2 Process Manager
```bash
# Install PM2 globally
npm install -g pm2

# Start with ecosystem config
pm2 start ecosystem.config.cjs

# Monitor processes
pm2 status
pm2 logs email-validator-api
```

## 🌐 API Endpoints

### Single Email Validation
```http
POST /api/validate-email
Content-Type: application/json

{
  "email": "user@domain.com"
}
```

**Response:**
```json
{
  "success": true,
  "email": "user@domain.com",
  "valid": true,
  "reason": null,
  "details": {
    "format": { "valid": true },
    "disposable": { "valid": true },
    "mx": { "valid": true },
    "placeholder": { "valid": true },
    "typo": { "valid": true }
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### Batch Email Validation
```http
POST /api/validate-emails
Content-Type: application/json

{
  "emails": ["user1@domain.com", "user2@domain.com"]
}
```

### File Upload & Validation
```http
POST /api/validate-csv
Content-Type: multipart/form-data

csvfile: [CSV file with email column]
```

```http
POST /api/validate-excel
Content-Type: multipart/form-data

excelfile: [Excel file with emails in first column]
```

### Health Check & Statistics
```http
GET /api/health
```

## 🔍 Advanced Validation Examples

### ✅ Valid Emails
```
john.doe@company.com          # Standard format
user+newsletter@gmail.com     # Plus addressing on supported provider
info@ballenberg-service.ch    # Mixed spam/normal keywords
test@münchen.de              # International domain (converts to punycode)
contact@company-tech.de       # Business domain with spam keyword
```

### ❌ Invalid Emails
```
x@gmail.com                   # Single character local part
admin@gmail.com               # Pure spam keyword
user+tag@aol.com              # Plus addressing on unsupported provider
sssssssss@gmail.com          # Repetitive characters
test@g-mail.com               # Typo domain
"quoted"@domain.com           # Quoted strings not allowed
user!special@domain.com       # Special characters restricted
fake@temp-spam.com            # Multiple spam keywords
very.long.email.address...@domain.com  # 250+ characters
```

## ⚙️ Configuration

Default settings in `config.js`:
- **Port**: 4444
- **Batch Size**: 10 emails per batch
- **File Size Limit**: 100MB
- **MX Cache TTL**: 5 minutes (success), 1 minute (failure)
- **Supported Formats**: CSV, XLS, XLSX
- **CORS**: Enabled for all origins

## 📁 File Upload Requirements

### CSV Files
- **Email Columns**: `email`, `Email`, `EMAIL`, `e-mail`, `E-mail`, `mail`
- **Formats**: `.csv`
- **Encoding**: UTF-8
- **Max Size**: 100MB

### Excel Files
- **Email Location**: First column or named email column
- **Formats**: `.xls`, `.xlsx`
- **Max Size**: 100MB

## 🏗️ Project Architecture

```
├── app.js                    # Application entry point
├── config.js                 # Configuration management
├── nodemon.json              # Development auto-reload settings
├── middleware.js             # Express middleware stack
├── routes/                   # API route definitions
│   ├── index.js
│   ├── validation.js         # Email validation endpoints
│   ├── file.js              # File upload & processing
│   └── health.js            # Health check & monitoring
├── services/                # Core business logic
│   ├── EmailValidationService.js  # Main validation engine
│   └── MxCache.js           # DNS caching with TTL
├── data/                    # Configuration data
│   ├── spam-keywords.txt    # Dynamic spam keyword database
│   ├── typo-domains.txt     # Typo domain correction mappings
│   └── placeholder-domains.txt  # Placeholder domain list
├── utils/                   # Utility functions
│   ├── fileUtils.js         # File processing utilities
│   └── responseUtils.js     # API response formatting
├── temp/                    # Temporary file storage
└── logs/                    # Application logs
```

## 🔒 Security Features

- **Input Validation**: Comprehensive input sanitization
- **File Security**: Type validation, size limits, scan protection
- **Thread Safety**: Concurrent processing with atomic operations
- **Memory Protection**: 250+ character email rejection
- **Character Filtering**: Restricted special characters
- **Cache Security**: TTL-based cache with automatic cleanup
- **Docker Security**: Non-root user, minimal attack surface

## 🚀 Performance Optimizations

- **Concurrent Processing**: Parallel validation with `Promise.all`
- **Intelligent Caching**: MX record caching with TTL
- **Memory Management**: Automatic cache cleanup, size limits
- **Dynamic Detection**: Pattern recognition without static lists
- **Punycode Processing**: Efficient international domain handling
- **Batch Processing**: Configurable batch sizes for optimal throughput

## 📊 Response Examples

### Typo Domain Detection
```json
{
  "valid": false,
  "reason": "Domain appears to be a typo. Did you mean 'gmail.com'?",
  "details": {
    "typo": { 
      "valid": false, 
      "suggested": "gmail.com" 
    }
  }
}
```

### International Domain
```json
{
  "email": "test@münchen.de",
  "valid": true,
  "normalized": "test@xn--mnchen-3ya.de"
}
```

### Plus Addressing Restriction
```json
{
  "email": "user+tag@aol.com",
  "valid": false,
  "reason": "Invalid email format",
  "details": {
    "format": { "valid": false }
  }
}
```

## 🐳 Docker Deployment

### Production Deployment
```bash
# Build optimized image
docker build -t email-validator-api .

# Run with custom port
docker run -p 8080:4444 -e NODE_ENV=production email-validator-api

# Docker Compose (recommended)
docker-compose up -d

# View logs
docker-compose logs -f email-validator-api
```

### Docker Configuration
- **Multi-stage build** for optimized image size
- **Non-root user** for security
- **Health checks** for container monitoring
- **Memory limits** and **restart policies**

## 📈 Monitoring & Logging

### Health Check Response
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "uptime": 3600.123,
  "memory": {
    "rss": 67108864,
    "heapTotal": 33554432,
    "heapUsed": 16777216
  },
  "cache": {
    "size": 150,
    "hitRate": 85.5,
    "hits": 1200,
    "misses": 210
  }
}
```

### Available Scripts
```bash
npm start                     # Production server
npm run dev                   # Development with auto-reload
npm test                      # Run test suite (when available)
```

## 🌍 International Support

- **Punycode Conversion**: Automatic international domain conversion
- **UTF-8 Support**: Full Unicode support in file processing
- **Multiple TLD Support**: Country-specific domain recognition
- **Encoding Detection**: Automatic file encoding detection

## 📝 Error Handling

- **400 Bad Request**: Invalid input, malformed JSON
- **413 Payload Too Large**: File size exceeds 100MB
- **415 Unsupported Media Type**: Invalid file format
- **429 Too Many Requests**: Rate limiting (if enabled)
- **500 Internal Server Error**: Server-side processing errors

## 🔧 Environment Variables

```bash
NODE_ENV=production           # Environment mode
PORT=4444                     # Server port
LOG_LEVEL=info               # Logging level
MAX_FILE_SIZE=104857600      # 100MB in bytes
CACHE_TTL=300000             # Cache TTL in milliseconds
```

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🤝 Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open Pull Request

## 📞 Support

- **Documentation**: Comprehensive API documentation
- **Issues**: GitHub Issues for bug reports and feature requests
- **Performance**: Optimized for high-volume email validation
- **Enterprise**: Custom deployment and integration support available

---

**Built with Furkan Beydemir for reliable email validation at scale**