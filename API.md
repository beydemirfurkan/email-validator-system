# Email Validator API - Kapsamlı Dokümantasyon

Bu dokümantasyon, E-posta Doğrulama API sisteminizin tüm detaylarını içermektedir. Frontend uygulamanızı geliştirmek için tüm endpoint'leri, veri yapılarını ve örnekleri burada bulabilirsiniz.

## İçindekiler

1. [Sistem Mimarisi](#sistem-mimarisi)
2. [Kimlik Doğrulama](#kimlik-doğrulama)
3. [Rate Limiting](#rate-limiting)
4. [API Endpoint'leri](#api-endpointleri)
5. [Veri Modelleri](#veri-modelleri)
6. [Hata Kodları](#hata-kodları)
7. [Örnek Kullanımlar](#örnek-kullanımlar)

## Sistem Mimarisi

### Teknoloji Stack'i
- **Backend**: Node.js, Express.js, TypeScript
- **Database**: PostgreSQL (Drizzle ORM)
- **Cache**: Upstash Redis
- **Authentication**: JWT + API Keys
- **File Processing**: Multer (CSV/Excel)
- **Validation**: Zod schema validation
- **Security**: Helmet, Rate limiting, CORS

### Proje Yapısı
```
src/
├── routes/           # API endpoint'leri
├── services/         # İş mantığı servisleri
├── middleware/       # Güvenlik ve auth middleware'leri
├── database/         # Veritabanı şeması ve bağlantıları
├── types/           # TypeScript tip tanımları
├── utils/           # Yardımcı fonksiyonlar
└── config/          # Yapılandırma dosyaları
```

## Kimlik Doğrulama

### 1. JWT Token Authentication
```javascript
// Header'da gönderilmesi gereken format
Authorization: Bearer <your-jwt-token>
```

### 2. API Key Authentication
```javascript
// Header'da gönderilmesi gereken format
X-API-Key: <your-api-key>
// veya
Api-Key: <your-api-key>
```

## Rate Limiting

### Genel Rate Limit Politikası
- **JWT Token**: Kullanıcı bazında limit
- **API Key**: API key bazında özelleştirilebilir limit
- **IP Bazında**: Anonim kullanım için IP bazında limit

### Specific Limits
- **Registration**: 100 kayıt/saat per IP
- **Login**: 200 giriş/15 dakika per IP
- **File Upload**: 50 dosya/saat per user
- **Email Validation**: API key'e göre değişken

## API Endpoint'leri

### Authentication Endpoints

#### POST /api/auth/register
Yeni kullanıcı kaydı oluşturur.

**Request Body:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "securepassword123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "User registered successfully",
    "user": {
      "id": 1,
      "name": "John Doe",
      "email": "john@example.com",
      "isActive": true,
      "createdAt": "2024-01-01T00:00:00Z"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  },
  "timestamp": "2024-01-01T00:00:00Z"
}
```

#### POST /api/auth/login
Kullanıcı girişi yapar.

**Request Body:**
```json
{
  "email": "john@example.com",
  "password": "securepassword123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Login successful",
    "user": {
      "id": 1,
      "name": "John Doe",
      "email": "john@example.com",
      "isActive": true
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  },
  "timestamp": "2024-01-01T00:00:00Z"
}
```

#### GET /api/auth/profile
Kullanıcı profil bilgilerini getirir.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": 1,
      "name": "John Doe",
      "email": "john@example.com",
      "isActive": true
    }
  },
  "timestamp": "2024-01-01T00:00:00Z"
}
```

#### PUT /api/auth/profile
Kullanıcı profil bilgilerini günceller.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "name": "John Smith"
}
```

#### PUT /api/auth/password
Kullanıcı şifresini değiştirir.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "currentPassword": "oldpassword",
  "newPassword": "newpassword123"
}
```

### Email Validation Endpoints

#### POST /api/email-validation/validate-email
Tek e-posta adresini doğrular.

**Request Body:**
```json
{
  "email": "test@example.com"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "valid": true,
    "email": "test@example.com",
    "score": 95,
    "reason": [],
    "details": {
      "format": true,
      "mx": true,
      "disposable": true,
      "role": true,
      "typo": true,
      "suspicious": true,
      "spamKeywords": true
    },
    "processingTime": 145,
    "fromCache": false,
    "provider": "Gmail"
  },
  "timestamp": "2024-01-01T00:00:00Z"
}
```

#### POST /api/email-validation/validate-emails
Toplu e-posta doğrulaması yapar.

**Request Body:**
```json
{
  "emails": [
    "test1@example.com",
    "test2@example.com",
    "invalid@fakeDomain.xyz"
  ]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "results": [
      {
        "valid": true,
        "email": "test1@example.com",
        "score": 95,
        "reason": [],
        "details": {
          "format": true,
          "mx": true,
          "disposable": true,
          "role": true,
          "typo": true,
          "suspicious": true,
          "spamKeywords": true
        }
      }
    ],
    "statistics": {
      "total": 3,
      "valid": 2,
      "invalid": 1,
      "validPercentage": "67",
      "invalidPercentage": "33"
    },
    "processing": {
      "totalSubmitted": 3,
      "duplicatesRemoved": 0,
      "processed": 3
    }
  },
  "timestamp": "2024-01-01T00:00:00Z"
}
```

#### GET /api/email-validation/health
Sistem sağlık durumunu kontrol eder.

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "ok",
    "timestamp": "2024-01-01T00:00:00Z",
    "uptime": 86400,
    "version": "2.0.0",
    "database": "connected",
    "cache": {
      "size": 1250,
      "hitRate": 85.5
    }
  },
  "timestamp": "2024-01-01T00:00:00Z"
}
```

### API Keys Management

#### GET /api/keys
Kullanıcının API anahtarlarını listeler.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "success": true,
  "data": {
    "apiKeys": [
      {
        "id": 1,
        "keyName": "Production API",
        "lastUsedAt": "2024-01-01T10:00:00Z",
        "expiresAt": "2024-06-01T00:00:00Z",
        "isActive": true,
        "rateLimit": 1000,
        "createdAt": "2024-01-01T00:00:00Z"
      }
    ],
    "total": 1
  },
  "timestamp": "2024-01-01T00:00:00Z"
}
```

#### POST /api/keys
Yeni API anahtarı oluşturur.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "keyName": "My Frontend App",
  "rateLimit": 500,
  "expiryDays": 90
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "API key created successfully",
    "apiKey": {
      "id": 2,
      "keyName": "My Frontend App",
      "key": "evapi_1234567890abcdef...",
      "rateLimit": 500,
      "expiresAt": "2024-04-01T00:00:00Z",
      "isActive": true,
      "createdAt": "2024-01-01T00:00:00Z"
    },
    "warning": "This is the only time you will see the raw API key. Please save it securely."
  },
  "timestamp": "2024-01-01T00:00:00Z"
}
```

#### PUT /api/keys/:id
API anahtarını günceller.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "keyName": "Updated Key Name",
  "rateLimit": 750,
  "isActive": true
}
```

#### DELETE /api/keys/:id
API anahtarını siler.

**Headers:** `Authorization: Bearer <token>`

### Contact Lists Management

#### GET /api/contact-lists
Kullanıcının iletişim listelerini getirir.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `page` (optional): Sayfa numarası (default: 1)
- `limit` (optional): Sayfa başına kayıt (default: 10, max: 100)
- `search` (optional): Arama metni

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Newsletter Subscribers",
      "description": "Main newsletter subscriber list",
      "totalContacts": 1500,
      "validContacts": 1350,
      "invalidContacts": 100,
      "riskyContacts": 45,
      "unknownContacts": 5,
      "lastValidatedAt": "2024-01-01T10:00:00Z",
      "tags": ["newsletter", "marketing"],
      "isActive": true,
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 1,
    "totalPages": 1
  },
  "timestamp": "2024-01-01T00:00:00Z"
}
```

#### POST /api/contact-lists
Yeni iletişim listesi oluşturur.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "name": "New Campaign List",
  "description": "List for Q1 campaign",
  "tags": ["campaign", "q1"]
}
```

#### GET /api/contact-lists/:id
Belirli bir iletişim listesinin detaylarını getirir.

#### PUT /api/contact-lists/:id
İletişim listesini günceller.

#### DELETE /api/contact-lists/:id
İletişim listesini siler (soft delete).

### Contacts Management

#### GET /api/contact-lists/:listId/contacts
Belirli bir listedeki kişileri getirir.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `page` (optional): Sayfa numarası
- `limit` (optional): Sayfa başına kayıt (max: 100)
- `status` (optional): Filtreleme için durum (pending, valid, invalid, risky, unknown)

#### POST /api/contact-lists/:listId/contacts
Listeye yeni kişi ekler.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "email": "newcontact@example.com",
  "firstName": "Jane",
  "lastName": "Doe",
  "phone": "+1234567890",
  "company": "Example Corp",
  "customFields": {
    "department": "Marketing",
    "source": "Website"
  },
  "tags": ["lead", "interested"],
  "notes": "High-value prospect"
}
```

#### POST /api/contacts/bulk-import
Toplu kişi içe aktarımı.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "contactListId": 1,
  "contacts": [
    {
      "email": "contact1@example.com",
      "firstName": "John",
      "lastName": "Smith"
    },
    {
      "email": "contact2@example.com",
      "firstName": "Jane",
      "lastName": "Doe"
    }
  ]
}
```

#### POST /api/contacts/:id/validate
Belirli bir kişinin e-posta adresini doğrular.

**Headers:** `Authorization: Bearer <token>`

### File Upload & Processing

#### POST /api/files/validate-csv
CSV dosyası yükler ve işler.

**Headers:** `Authorization: Bearer <token>` (opsiyonel)

**Form Data:**
- `file`: CSV dosyası
- `immediate`: "true" - anında işle, "false" - arka planda işle

**Response (Immediate Processing):**
```json
{
  "success": true,
  "data": {
    "source": "csv_upload",
    "filename": "emails.csv",
    "results": [...],
    "statistics": {
      "total": 100,
      "valid": 85,
      "invalid": 15,
      "validPercentage": 85,
      "invalidPercentage": 15
    },
    "processing": {
      "totalSubmitted": 102,
      "duplicatesRemoved": 2,
      "processed": 100
    }
  }
}
```

**Response (Background Processing):**
```json
{
  "success": true,
  "data": {
    "message": "CSV file uploaded successfully and queued for processing",
    "requestId": "req_1234567890",
    "filename": "emails.csv",
    "status": "processing",
    "statusUrl": "/api/files/status/req_1234567890",
    "estimatedTime": "5 minutes"
  }
}
```

#### POST /api/files/validate-excel
Excel dosyası yükler ve işler.

#### GET /api/files/status/:requestId
Arka planda işlenen dosyanın durumunu kontrol eder.

#### POST /api/files/export-csv
Sonuçları CSV olarak dışa aktarır.

**Request Body:**
```json
{
  "results": [...]
}
```

#### POST /api/files/export-excel
Sonuçları Excel olarak dışa aktarır.

### Analytics Endpoints

#### GET /api/analytics/dashboard
Kullanıcının dashboard analitiğini getirir.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `period` (optional): Analiz periyodu gün cinsinden (default: 30, max: 365)

**Response:**
```json
{
  "success": true,
  "data": {
    "dashboard": {
      "period": "30 days",
      "validations": {
        "total": 5000,
        "averageProcessingTime": 145
      },
      "contacts": {
        "totalLists": 5,
        "totalContacts": 15000,
        "valid": 12500,
        "invalid": 2000,
        "risky": 450,
        "unknown": 50,
        "validPercentage": "83.33"
      },
      "recentActivity": [
        {
          "date": "2024-01-01",
          "validations": 250
        }
      ]
    }
  },
  "timestamp": "2024-01-01T00:00:00Z"
}
```

#### GET /api/analytics/validation-logs
Doğrulama geçmişini getirir.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `page`, `limit`: Sayfalama
- `apiKeyId`: Belirli API key filtresi
- `startDate`, `endDate`: Tarih aralığı

#### GET /api/analytics/top-domains
En çok doğrulanan domain'leri getirir.

#### GET /api/analytics/validation-trends
Zaman içerisinde doğrulama eğilimlerini getirir.

### Plans & Subscriptions

#### GET /api/plans
Mevcut planları listeler (public endpoint).

**Response:**
```json
{
  "success": true,
  "data": {
    "plans": [
      {
        "id": 1,
        "name": "Basic",
        "description": "Perfect for small businesses",
        "price": 29.99,
        "billingCycle": "monthly",
        "validationsPerMonth": 5000,
        "maxApiKeys": 2,
        "maxContactLists": 5,
        "bulkValidation": true,
        "apiAccess": true,
        "features": [
          {
            "name": "Email Validation",
            "value": "5000/month",
            "enabled": true
          }
        ]
      }
    ]
  }
}
```

#### GET /api/plans/subscriptions
Kullanıcının mevcut aboneliğini getirir.

**Headers:** `Authorization: Bearer <token>`

#### POST /api/plans/:id/subscribe
Plana abone olur.

**Headers:** `Authorization: Bearer <token>`

#### GET /api/plans/usage
Kullanım istatistiklerini getirir.

**Headers:** `Authorization: Bearer <token>`

## Veri Modelleri

### ValidationResult
```typescript
interface ValidationResult {
  valid: boolean;
  email: string;
  score: number; // 0-100
  reason: string[];
  details: {
    format: boolean;
    mx: boolean;
    smtp?: boolean;
    disposable: boolean;
    role: boolean;
    typo: boolean;
    suspicious: boolean;
    spamKeywords: boolean;
  };
  suggestion?: string;
  provider?: string;
  processingTime?: number;
  fromCache?: boolean;
  error?: any;
}
```

### User
```typescript
interface User {
  id: number;
  email: string;
  name: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
```

### ContactList
```typescript
interface ContactList {
  id: number;
  name: string;
  description?: string;
  totalContacts: number;
  validContacts: number;
  invalidContacts: number;
  riskyContacts: number;
  unknownContacts: number;
  lastValidatedAt?: string;
  tags: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
```

### Contact
```typescript
interface Contact {
  id: number;
  contactListId: number;
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  company?: string;
  customFields: Record<string, any>;
  validationStatus: 'pending' | 'validating' | 'valid' | 'invalid' | 'risky' | 'unknown';
  validationResult?: ValidationResult;
  validationScore?: number;
  lastValidatedAt?: string;
  tags: string[];
  notes?: string;
  isSubscribed: boolean;
  bouncedAt?: string;
  unsubscribedAt?: string;
  createdAt: string;
  updatedAt: string;
}
```

## Hata Kodları

### HTTP Status Codes
- **200 OK**: İstek başarılı
- **201 Created**: Kaynak oluşturuldu
- **400 Bad Request**: Geçersiz istek
- **401 Unauthorized**: Kimlik doğrulama gerekli
- **403 Forbidden**: Erişim reddedildi
- **404 Not Found**: Kaynak bulunamadı
- **429 Too Many Requests**: Rate limit aşıldı
- **500 Internal Server Error**: Sunucu hatası

### Error Response Format
```json
{
  "success": false,
  "error": "Error message",
  "timestamp": "2024-01-01T00:00:00Z",
  "details": {
    "code": "VALIDATION_ERROR",
    "field": "email"
  }
}
```

### Common Error Messages
- `"Access token required"`: JWT token eksik
- `"Invalid or expired token"`: JWT token geçersiz
- `"API key required"`: API key eksik
- `"Invalid API key"`: API key geçersiz
- `"Rate limit exceeded"`: Rate limit aşıldı
- `"User with this email already exists"`: E-posta zaten kayıtlı
- `"Contact list not found"`: İletişim listesi bulunamadı

## Örnek Kullanımlar

### 1. Kullanıcı Kaydı ve Giriş Akışı

```javascript
// 1. Kullanıcı kaydı
const registerResponse = await fetch('/api/auth/register', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    name: 'John Doe',
    email: 'john@example.com',
    password: 'securepassword123'
  })
});

const { data } = await registerResponse.json();
const token = data.token;

// Token'ı sakla (localStorage, cookie vb.)
localStorage.setItem('authToken', token);

// 2. Giriş
const loginResponse = await fetch('/api/auth/login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    email: 'john@example.com',
    password: 'securepassword123'
  })
});
```

### 2. API Key Oluşturma ve Kullanma

```javascript
// API Key oluştur
const createKeyResponse = await fetch('/api/keys', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    keyName: 'Frontend App',
    rateLimit: 1000,
    expiryDays: 90
  })
});

const { data } = await createKeyResponse.json();
const apiKey = data.apiKey.key;

// API Key ile e-posta doğrulama
const validationResponse = await fetch('/api/email-validation/validate-email', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': apiKey
  },
  body: JSON.stringify({
    email: 'test@example.com'
  })
});
```

### 3. CSV Dosyası Yükleme ve İşleme

```javascript
// Dosya yükleme
const formData = new FormData();
formData.append('file', csvFile);
formData.append('immediate', 'true');

const uploadResponse = await fetch('/api/files/validate-csv', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`
  },
  body: formData
});

const result = await uploadResponse.json();

// Sonuçları CSV olarak dışa aktar
const exportResponse = await fetch('/api/files/export-csv', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    results: result.data.results
  })
});

const csvBlob = await exportResponse.blob();
const downloadUrl = URL.createObjectURL(csvBlob);
```

### 4. İletişim Listesi Yönetimi

```javascript
// Yeni liste oluştur
const createListResponse = await fetch('/api/contact-lists', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    name: 'Newsletter Subscribers',
    description: 'Main newsletter list',
    tags: ['newsletter', 'marketing']
  })
});

const list = await createListResponse.json();
const listId = list.data.contactList.id;

// Listeye toplu kişi ekle
const bulkImportResponse = await fetch('/api/contacts/bulk-import', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    contactListId: listId,
    contacts: [
      {
        email: 'subscriber1@example.com',
        firstName: 'John',
        lastName: 'Doe'
      },
      {
        email: 'subscriber2@example.com',
        firstName: 'Jane',
        lastName: 'Smith'
      }
    ]
  })
});
```

### 5. Dashboard Analytics

```javascript
// Dashboard verilerini getir
const dashboardResponse = await fetch('/api/analytics/dashboard?period=30', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

const dashboard = await dashboardResponse.json();

// Validation logs'u getir
const logsResponse = await fetch('/api/analytics/validation-logs?page=1&limit=50', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

const logs = await logsResponse.json();
```

### 6. React Hook Örneği

```javascript
// useEmailValidation custom hook
import { useState, useCallback } from 'react';

export function useEmailValidation() {
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);

  const validateEmail = useCallback(async (email) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/email-validation/validate-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': process.env.REACT_APP_API_KEY
        },
        body: JSON.stringify({ email })
      });

      const data = await response.json();
      
      if (data.success) {
        setResults(data.data);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Network error occurred');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const validateBatch = useCallback(async (emails) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/email-validation/validate-emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': process.env.REACT_APP_API_KEY
        },
        body: JSON.stringify({ emails })
      });

      const data = await response.json();
      
      if (data.success) {
        setResults(data.data);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Network error occurred');
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    validateEmail,
    validateBatch,
    isLoading,
    results,
    error,
    clearResults: () => setResults(null),
    clearError: () => setError(null)
  };
}
```

## Güvenlik Notları

### CORS Politikası
API varsayılan olarak `'*'` origin'e izin verir. Production'da bunu sınırlandırın.

### Rate Limiting
- API key'ler kendi rate limit'lerine sahiptir
- IP bazında global rate limiting aktif
- 429 status code döndürülür

### Data Validation
Tüm endpoint'ler Zod schema validation kullanır. Geçersiz veri gönderimi 400 Bad Request döndürür.

### Authentication
- JWT token'lar 24 saat geçerli
- API key'ler opsiyonel expiry date'e sahip
- Bcrypt ile hash'lenen şifreler

Bu dokümantasyon sisteminizin tam kapsamını içermektedir. Frontend geliştirme sürecinizde referans olarak kullanabilirsiniz.