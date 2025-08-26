# 🧪 Email Validator API - Testing & Debugging Guide

Bu rehber, email validator API'nizi kapsamlı bir şekilde test etmek ve debug etmek için gerekli tüm araçları ve prosedürleri içerir. Yüzlerce kullanıcı için production-ready performans sağlamak amacıyla tasarlanmıştır.

## 📋 Test Suite Genel Bakış

### 🏗️ Test Kategorileri
- **Unit Tests**: Temel fonksiyon ve servis testleri
- **Integration Tests**: API endpoint ve database entegrasyon testleri
- **Load Tests**: Yük testleri (Artillery)
- **Stress Tests**: Stres testleri (Autocannon)
- **Concurrent User Tests**: Çoklu kullanıcı simülasyonu
- **Performance Tests**: Performans ve memory leak testleri

### 📦 Test Dependencies
```bash
# Test framework ve utilities
- jest: Test framework
- supertest: HTTP endpoint testing
- artillery: Load testing
- autocannon: Stress testing
- clinic: Performance profiling
```

## 🚀 Test Kurulumu

### 1. Test Dependencies Kurulumu
```bash
npm install --save-dev jest supertest @types/jest @types/supertest artillery autocannon clinic
```

### 2. Test Database Hazırlama
Test ortamı otomatik olarak ayrı bir SQLite database kullanır:
```
./test-database.sqlite
```

## 🧪 Test Çalıştırma

### Temel Test Komutları
```bash
# Tüm testleri çalıştır
npm test

# Test coverage raporu ile çalıştır
npm run test:coverage

# Watch mode (development sırasında)
npm run test:watch

# Sadece integration testleri
npm run test:integration

# Concurrent user testleri
npm run test:concurrent
```

### Performans ve Yük Testleri
```bash
# Load testing (Artillery)
npm run test:load

# Stress testing (Autocannon)
npm run test:stress

# Tüm testler (unit + load)
npm run test:all
```

## 📊 Test Sonuçları ve Raporlama

### Jest Test Coverage
```bash
npm run test:coverage
# Coverage raporu: coverage/lcov-report/index.html
```

### Artillery Load Test Raporu
```bash
npm run test:load
# Çıktı: RPS, latency, error rates
# HTML rapor: artillery-report.html
```

### Autocannon Stress Test Raporu
```bash
npm run test:stress
# Çıktı: Detailed JSON raporu timestamp ile
```

## 🔧 API Debugging Tools

### Built-in Debug Endpoints
API'da entegre debug endpoints:

```bash
# System health check
GET /api/debug/system-health

# Request performance metrics
GET /api/debug/request-metrics

# Memory usage statistics
GET /api/debug/memory-stats

# Database connection pool stats
GET /api/debug/database-stats

# Email validation cache stats
GET /api/debug/validation-stats

# Request history search
POST /api/debug/search-requests
{
  "userId": 123,
  "endpoint": "/validate-email",
  "timeRange": 60
}

# Export metrics to file
POST /api/debug/export-metrics

# Clear metrics history
DELETE /api/debug/clear-metrics
```

### Debug Endpoint Kullanımı
```javascript
// Authentication gerekli
const response = await fetch('/api/debug/system-health', {
  headers: {
    'Authorization': 'Bearer your-jwt-token'
  }
});

const healthData = await response.json();
console.log('System Health:', healthData);
```

## 🔍 Performance Monitoring

### Real-time Monitoring
API otomatik olarak aşağıdaki metrikleri toplar:
- Request response times
- Memory usage patterns
- Database connection pool status
- Email validation cache performance
- Error rates and patterns

### Memory Leak Detection
```javascript
// Test sırasında memory leak tespiti
const initialMemory = process.memoryUsage();

// Yoğun operasyonlar
for (let i = 0; i < 1000; i++) {
  await validateEmail(`user${i}@example.com`);
}

// Memory artışı kontrolü
const finalMemory = process.memoryUsage();
const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024); // 50MB limit
```

## 🏋️ Concurrent User Testing

### 50 Concurrent User Simulation
```bash
npm run test:concurrent
```

Bu test:
- 50 kullanıcının eşzamanlı kayıt olmasını simüle eder
- Her kullanıcı için API key oluşturur
- Her kullanıcı 20 email validation yapar
- Database deadlock ve race condition kontrolleri
- Memory usage monitoring

### Beklenen Sonuçlar
- **Success Rate**: >95%
- **Average Response Time**: <2000ms
- **Memory Increase**: <100MB
- **No Database Deadlocks**: ✅

## 📈 Load Testing Scenarios

### Artillery Load Test Senaryoları

1. **Email Validation Load Test** (40% weight)
   - User registration
   - API key creation
   - 10 email validations per user

2. **Batch Validation Load Test** (30% weight)
   - Batch email validation (5 emails per batch)

3. **Contact Management Load Test** (20% weight)
   - Contact list creation
   - Contact additions

4. **Analytics Load Test** (10% weight)
   - Dashboard ve analytics endpoints

### Test Phases
```yaml
phases:
  - duration: 60s, arrivalRate: 10  # Warm up
  - duration: 120s, arrivalRate: 20 # Ramp up
  - duration: 180s, arrivalRate: 50 # Sustained load
  - duration: 60s, arrivalRate: 100 # Spike test
```

## 🚨 Error Handling ve Debugging

### Comprehensive Error Logging
API otomatik olarak şu logları tutar:
- `/logs/app-YYYY-MM-DD.log`: Genel application logs
- `/logs/error-YYYY-MM-DD.log`: Sadece error logs
- `/logs/access-YYYY-MM-DD.log`: HTTP request logs
- `/logs/security-YYYY-MM-DD.log`: Security event logs
- `/logs/performance-YYYY-MM-DD.log`: Performance logs
- `/logs/validation-YYYY-MM-DD.log`: Email validation logs

### Debug Utilities
```javascript
import { DebugUtils } from './utils/debug.utils';

// Operation profiling
const profiler = DebugUtils.createProfiler('email-validation');
// ... validation logic
const profile = profiler.end();
// Output: { operation: 'email-validation', duration: 123.45, memoryDelta: 1024 }

// Request debugging
const debugInfo = DebugUtils.debugRequest({
  userId: 123,
  endpoint: '/validate-email',
  timeRange: 30 // minutes
});
```

## 🔒 Security Testing

### Security Event Monitoring
API otomatik olarak şu security eventleri loglar:
- Failed authentication attempts
- Rate limiting violations
- Suspicious request patterns
- Invalid API key usage

### Rate Limiting Tests
```javascript
// Rate limiting test example
const apiKey = 'test-key-with-low-limit';
const requests = Array.from({ length: 50 }, () =>
  fetch('/api/validate-email', {
    headers: { 'X-API-Key': apiKey },
    body: JSON.stringify({ email: 'test@example.com' })
  })
);

const responses = await Promise.all(requests);
const rateLimitedCount = responses.filter(r => r.status === 429).length;
expect(rateLimitedCount).toBeGreaterThan(0);
```

## 🎯 Performance Benchmarks

### Expected Performance Metrics
- **Single Email Validation**: <200ms
- **Batch Validation (5 emails)**: <500ms
- **User Registration**: <300ms
- **Database Operations**: <100ms
- **Memory Usage**: <200MB sustained
- **Request Rate**: >100 RPS

### Performance Thresholds
```javascript
// Debug utils automatically flags slow requests
const PERFORMANCE_THRESHOLDS = {
  slowRequest: 1000,    // >1s
  slowDb: 500,          // >500ms
  highMemory: 90,       // >90% heap usage
  highErrorRate: 10     // >10% error rate
};
```

## 📊 Database Optimization

### Connection Pooling
API kullandığı optimized connection pool:
```typescript
const poolConfig = {
  maxConnections: 10,
  acquireTimeoutMs: 30000,
  idleTimeoutMs: 300000,  // 5 minutes
  reapIntervalMs: 60000   // 1 minute cleanup
};
```

### SQLite Optimizations
```sql
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA cache_size = 1000;
PRAGMA temp_store = MEMORY;
PRAGMA mmap_size = 268435456; -- 256MB
PRAGMA foreign_keys = ON;
PRAGMA busy_timeout = 5000;
```

## 🐛 Common Issues ve Solutions

### 1. Test Database Issues
```bash
# Test database cleanup
rm test-database.sqlite
npm test
```

### 2. Port Already in Use
```bash
# Kill process using port 4444
lsof -ti:4444 | xargs kill -9
```

### 3. Memory Issues During Testing
```bash
# Increase Node.js memory limit
export NODE_OPTIONS="--max-old-space-size=4096"
npm test
```

### 4. Timeout Issues
```javascript
// Jest config'de timeout artırma
module.exports = {
  testTimeout: 30000, // 30 seconds
  // ...
};
```

## 🔄 CI/CD Integration

### GitHub Actions Example
```yaml
name: API Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - run: npm ci
      - run: npm run build
      - run: npm run typecheck
      - run: npm test
      - run: npm run test:load
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
```

## 📝 Test Writing Guidelines

### Unit Test Example
```javascript
describe('EmailValidationService', () => {
  it('should validate email format correctly', async () => {
    const service = new EmailValidationService();
    const result = await service.validateSingle('user@gmail.com');
    
    expect(result.valid).toBe(true);
    expect(result.score).toBeGreaterThan(80);
    expect(result.checks.format).toBe(true);
  });
});
```

### Integration Test Example
```javascript
describe('POST /api/validate-email', () => {
  it('should validate email with valid API key', async () => {
    const response = await request(app)
      .post('/api/validate-email')
      .set('X-API-Key', testApiKey)
      .send({ email: 'user@gmail.com' })
      .expect(200);
    
    expect(response.body.success).toBe(true);
    expect(response.body.data.validation.valid).toBeDefined();
  });
});
```

## 🎯 Production Readiness Checklist

### Before Production Deploy
- [ ] All unit tests passing
- [ ] Integration tests passing
- [ ] Load tests meeting performance targets
- [ ] Stress tests showing no memory leaks
- [ ] Concurrent user tests passing
- [ ] Security tests passing
- [ ] Error handling comprehensive
- [ ] Logging configured properly
- [ ] Monitoring endpoints working
- [ ] Database optimizations applied

### Performance Targets for Production
- [ ] >99.9% uptime
- [ ] <500ms average response time
- [ ] >1000 RPS capacity
- [ ] <1% error rate
- [ ] Memory usage stable
- [ ] Database connections efficient

---

## 🚀 Quick Start Testing

```bash
# 1. Install dependencies
npm install

# 2. Build the project
npm run build

# 3. Run comprehensive tests
npm run test:all

# 4. Check system health (server running)
curl http://localhost:4444/api/debug/system-health \
  -H "Authorization: Bearer YOUR-JWT-TOKEN"

# 5. Run stress test
npm run test:stress
```

Bu test suite, API'nizin production ortamında yüzlerce kullanıcı tarafından güvenle kullanılabileceğini garanti eder.