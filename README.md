# 🚀 SaaS Email Validation API Platform

Professional enterprise-grade SaaS email validation API with comprehensive user management, subscription handling, contact management, and advanced analytics. Built with TypeScript, Express, Drizzle ORM, and Zod validation.

## ✨ Key Features

- **🔐 Complete SaaS Platform** - User authentication, API keys, subscription management
- **📊 Contact Management** - Lists, contacts, bulk import/export, validation tracking
- **💳 Subscription System** - Multiple plans, usage quotas, billing cycles
- **📈 Advanced Analytics** - Dashboard, trends, validation logs, system stats
- **🔍 9-Layer Email Validation** - Advanced fraud detection and pattern recognition
- **📂 File Processing** - CSV/Excel batch processing with background queues
- **🌍 International Support** - Punycode domains, UTF-8 encoding
- **⚡ High Performance** - Concurrent processing, intelligent caching, TypeScript

## 🏗️ Technology Stack

- **Backend**: TypeScript + Express.js + Zod validation
- **Database**: SQLite + Drizzle ORM (easy migration to PostgreSQL/MySQL)
- **Authentication**: JWT + bcrypt + API Keys
- **File Processing**: Multer + XLSX + CSV parser
- **Caching**: In-memory MX record cache with TTL
- **Security**: Rate limiting, input validation, type safety

## 📋 Complete API Documentation

### 🔐 Authentication & User Management
```bash
POST   /api/auth/register         # User registration
POST   /api/auth/login            # User login
GET    /api/auth/profile          # Get user profile
PUT    /api/auth/profile          # Update user profile  
PUT    /api/auth/password         # Change password
POST   /api/auth/refresh          # Refresh JWT token
```

### 🔑 API Key Management
```bash
GET    /api/keys                  # List user's API keys
POST   /api/keys                  # Create new API key
GET    /api/keys/:id              # Get API key details
PUT    /api/keys/:id              # Update API key
DELETE /api/keys/:id              # Delete API key
POST   /api/keys/:id/regenerate   # Regenerate API key
```

### 📧 Email Validation Core
```bash
POST   /api/validate-email        # Single email validation
POST   /api/validate-emails       # Batch email validation
GET    /api/health                # System health check
```

### 📁 File Processing & Background Jobs
```bash
POST   /api/files/validate-csv         # CSV file upload & validation
POST   /api/files/validate-excel       # Excel file upload & validation
GET    /api/files/status/:requestId    # Check processing status
POST   /api/files/export-csv           # Export results as CSV
POST   /api/files/export-excel         # Export results as Excel
GET    /api/files/queue                # Processing queue status
```

### 📋 Contact List Management
```bash
GET    /api/contact-lists               # List user's contact lists
POST   /api/contact-lists              # Create contact list
GET    /api/contact-lists/:id          # Get contact list details
PUT    /api/contact-lists/:id          # Update contact list
DELETE /api/contact-lists/:id          # Delete contact list
GET    /api/contact-lists/:id/statistics # Get list statistics
```

### 👥 Contact Management
```bash
GET    /api/contacts/lists/:listId/contacts  # List contacts in list
POST   /api/contacts/lists/:listId/contacts  # Add contact to list
GET    /api/contacts/:id                     # Get contact details
PUT    /api/contacts/:id                     # Update contact
DELETE /api/contacts/:id                     # Delete contact
POST   /api/contacts/bulk-import             # Bulk import contacts
POST   /api/contacts/:id/validate           # Validate specific contact
```

### 💳 Plans & Subscription Management
```bash
GET    /api/plans                      # List available plans (public)
GET    /api/plans/:id                  # Get plan details (public)
GET    /api/plans/subscriptions        # Get user's subscription
POST   /api/plans/:id/subscribe        # Subscribe to plan
PUT    /api/plans/subscriptions/:id    # Update subscription
GET    /api/plans/usage                # Get usage statistics
```

### 📈 Analytics & Monitoring
```bash
GET    /api/analytics/dashboard         # Dashboard analytics
GET    /api/analytics/validation-logs   # Validation history
GET    /api/analytics/top-domains       # Most validated domains
GET    /api/analytics/validation-trends # Validation trends over time
GET    /api/analytics/system-stats      # System statistics
POST   /api/analytics/cache/clear       # Clear system cache
```

## 🚀 Quick Start

### Prerequisites
- Node.js 16+
- npm or yarn

### Development Setup
```bash
# Clone the repository
git clone <repository-url>
cd email-validator-api

# Install dependencies
npm install

# Build TypeScript
npm run build

# Start development server with hot reload
npm run dev

# Server runs on http://localhost:4444
```

### Production Setup
```bash
# Build for production
npm run build

# Start production server
npm start

# Or use PM2 for process management
pm2 start ecosystem.config.cjs
```

### Docker Deployment
```bash
# Build and run with Docker Compose
docker-compose up -d

# Access API at: http://localhost:4444
```

## 📊 Usage Examples

### 1. User Registration & Login
```javascript
// Register new user
const registerResponse = await fetch('/api/auth/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'John Doe',
    email: 'john@example.com',
    password: 'securepassword123'
  })
});

// Login
const loginResponse = await fetch('/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'john@example.com',
    password: 'securepassword123'
  })
});

const { token } = await loginResponse.json();
```

### 2. API Key Creation
```javascript
// Create API key (requires authentication)
const apiKeyResponse = await fetch('/api/keys', {
  method: 'POST',
  headers: { 
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    keyName: 'Production Key',
    rateLimit: 1000
  })
});

const { apiKey } = await apiKeyResponse.json();
```

### 3. Email Validation
```javascript
// Single email validation
const validationResponse = await fetch('/api/validate-email', {
  method: 'POST',
  headers: { 
    'Content-Type': 'application/json',
    'X-API-Key': 'evapi_your_api_key_here'
  },
  body: JSON.stringify({
    email: 'user@domain.com'
  })
});

// Batch email validation
const batchResponse = await fetch('/api/validate-emails', {
  method: 'POST',
  headers: { 
    'Content-Type': 'application/json',
    'X-API-Key': 'evapi_your_api_key_here'
  },
  body: JSON.stringify({
    emails: ['user1@domain.com', 'user2@domain.com']
  })
});
```

### 4. Contact Management
```javascript
// Create contact list
const listResponse = await fetch('/api/contact-lists', {
  method: 'POST',
  headers: { 
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    name: 'Marketing Leads',
    description: 'Email list for marketing campaigns'
  })
});

// Add contact to list
const contactResponse = await fetch(`/api/contacts/lists/${listId}/contacts`, {
  method: 'POST',
  headers: { 
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    email: 'lead@company.com',
    firstName: 'Jane',
    lastName: 'Smith',
    company: 'Acme Corp'
  })
});
```

### 5. File Upload Processing
```javascript
// Upload CSV file for validation
const formData = new FormData();
formData.append('file', csvFile);
formData.append('immediate', 'true'); // Process immediately

const uploadResponse = await fetch('/api/files/validate-csv', {
  method: 'POST',
  headers: { 
    'Authorization': `Bearer ${token}`
  },
  body: formData
});
```

## 🛡️ Advanced Email Validation Pipeline

Our system processes emails through **9 comprehensive layers**:

1. **Length Validation** - Rejects 250+ character emails
2. **International Domain Processing** - Punycode conversion (`münchen.de` → `xn--mnchen-3ya.de`)
3. **Format & Character Validation** - RFC-compliant with practical restrictions
4. **Dynamic Suspicious Pattern Detection** - AI-powered spam pattern recognition
5. **Smart Plus Addressing Validation** - Provider-specific rules
6. **Typo Domain Detection** - 500+ known typo patterns with suggestions
7. **Disposable Email Detection** - Real-time updated database
8. **Intelligent Spam Keyword Analysis** - Context-aware spam detection
9. **MX Record Validation** - DNS lookup with intelligent caching

### Validation Examples

✅ **Valid Emails:**
```
john.doe@company.com              # Standard format
user+newsletter@gmail.com         # Plus addressing (Gmail)
info@ballenberg-service.ch        # Mixed keywords (business context)
test@münchen.de                   # International domain
contact@company-tech.de           # Business domain
```

❌ **Invalid Emails:**
```
x@gmail.com                       # Single character
admin@gmail.com                   # Pure spam keyword
user+tag@aol.com                  # Plus addressing (unsupported)
sssssssss@gmail.com              # Repetitive characters
test@g-mail.com                   # Typo domain
fake@temp-spam.com                # Multiple spam keywords
```

## 🔒 Security Features

- **JWT Authentication** - Secure token-based auth with refresh
- **API Key Management** - Secure API key generation and validation
- **Rate Limiting** - Per-user, per-IP, and per-API-key limits
- **Input Validation** - Zod schema validation for all endpoints
- **Password Security** - bcrypt hashing with salt rounds
- **File Upload Security** - Type validation, size limits, path sanitization
- **SQL Injection Protection** - Drizzle ORM with parameterized queries
- **TypeScript Safety** - Compile-time type checking

## 📈 Subscription & Usage Management

### Available Plans
The system supports multiple subscription plans with:
- **Validation Quotas** - Monthly email validation limits
- **API Access** - Rate limiting and feature access
- **Contact Management** - Number of contact lists and contacts
- **File Processing** - Bulk validation capabilities
- **Priority Support** - Different support tiers

### Usage Tracking
- Real-time usage monitoring
- Quota enforcement
- Usage analytics and reporting
- Automatic quota reset
- Overage notifications

## 📊 Analytics & Monitoring

### Dashboard Metrics
- Total validations performed
- Success/failure rates
- Average processing times
- Contact list statistics
- Usage trends over time

### System Monitoring
- Cache performance (hit/miss rates)
- Memory usage and optimization
- Background job queue status
- API response times
- Error tracking and logging

## 🐳 Docker Configuration

### Development
```bash
# Development with hot reload
docker-compose -f docker-compose.dev.yml up
```

### Production
```bash
# Production deployment
docker-compose up -d

# Scale for high availability
docker-compose up -d --scale email-validator-api=3
```

### Environment Variables
```env
NODE_ENV=production
PORT=4444
JWT_SECRET=your-super-secret-jwt-key
DATABASE_PATH=./database.sqlite
LOG_LEVEL=info
CACHE_TTL=300000
MAX_FILE_SIZE=104857600
RATE_LIMIT_WINDOW=900000
RATE_LIMIT_MAX_REQUESTS=100
```

## 📁 Project Structure

```
src/
├── app.ts                        # Application entry point
├── config/
│   └── app-config.ts            # Configuration management
├── database/
│   ├── schema.ts                # Drizzle database schema
│   └── connection.ts            # Database connection
├── middleware/
│   ├── auth.middleware.ts       # Authentication middleware
│   └── rate-limiter.middleware.ts # Rate limiting
├── routes/                      # API route handlers
│   ├── auth.routes.ts           # Authentication endpoints
│   ├── api-keys.routes.ts       # API key management
│   ├── email-validation.routes.ts # Core validation
│   ├── file-upload.routes.ts    # File processing
│   ├── contact-lists.routes.ts  # Contact list management
│   ├── contacts.routes.ts       # Contact management
│   ├── plans.routes.ts          # Subscription management
│   └── analytics.routes.ts      # Analytics & monitoring
├── services/                    # Business logic services
│   ├── email-validation.service.ts # Core validation engine
│   ├── mx-cache.service.ts      # DNS caching service
│   └── background-processor.service.ts # Background jobs
├── types/                       # Type definitions
│   ├── api.ts                   # API response types
│   └── validation.ts            # Zod validation schemas
└── utils/                       # Utility functions
    ├── file.utils.ts            # File processing utilities
    └── response.utils.ts        # API response helpers
```

## 🚀 Performance Optimizations

- **Concurrent Processing** - Parallel validation with Promise.all
- **Intelligent Caching** - MX record caching with TTL
- **Background Processing** - Async file processing queues
- **Database Optimization** - Indexed queries and connection pooling
- **Memory Management** - Automatic cache cleanup and size limits
- **TypeScript Performance** - Compile-time optimizations

## 📝 API Response Format

All API responses follow a consistent format:

```typescript
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: string;
  meta?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
```

## 🔧 Configuration Options

The system is highly configurable via `src/config/app-config.ts`:

- Server settings (port, limits)
- Validation parameters (batch size, cache TTL)
- File upload restrictions
- CORS configuration
- Database connection settings

## 📞 Support & Contributing

- **Issues**: GitHub Issues for bug reports and feature requests
- **Documentation**: Comprehensive inline documentation
- **Contributing**: Follow TypeScript and ESLint guidelines
- **Testing**: Unit tests with Jest (implement as needed)

## 📄 License

MIT License - see LICENSE file for details.

---

**🚀 Ready for production! A complete SaaS email validation platform built with modern TypeScript architecture.**