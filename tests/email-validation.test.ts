import request from 'supertest';
import app from '../src/app';
import { db } from '../src/database/connection';
import { users, apiKeys } from '../src/database/schema';

describe('Email Validation API Tests', () => {
  let userToken: string;
  let apiKey: string;
  let userId: number;

  beforeAll(async () => {
    // Clean database
    await db.delete(apiKeys);
    await db.delete(users);

    // Register test user
    const registerResponse = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Test User',
        email: 'test@example.com',
        password: 'TestPassword123!'
      });

    userToken = registerResponse.body.data.token;
    userId = registerResponse.body.data.user.id;

    // Create API key
    const apiKeyResponse = await request(app)
      .post('/api/keys')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        keyName: 'Test API Key',
        rateLimit: 1000
      });

    apiKey = apiKeyResponse.body.data.apiKey.apiKey;
  });

  describe('GET /api/health', () => {
    it('should return system health status', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('ok');
      expect(response.body.data.uptime).toBeDefined();
      expect(response.body.data.cache).toBeDefined();
    });
  });

  describe('POST /api/validate-email', () => {
    it('should validate a single email successfully', async () => {
      const response = await request(app)
        .post('/api/validate-email')
        .set('X-API-Key', apiKey)
        .send({
          email: 'user@gmail.com'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.validation.email).toBe('user@gmail.com');
      expect(response.body.data.validation.valid).toBeDefined();
      expect(response.body.data.validation.score).toBeDefined();
      expect(response.body.data.validation.checks).toBeDefined();
    });

    it('should reject invalid email format', async () => {
      const response = await request(app)
        .post('/api/validate-email')
        .set('X-API-Key', apiKey)
        .send({
          email: 'invalid-email'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.validation.valid).toBe(false);
      expect(response.body.data.validation.checks.format).toBe(false);
    });

    it('should detect disposable email domains', async () => {
      const response = await request(app)
        .post('/api/validate-email')
        .set('X-API-Key', apiKey)
        .send({
          email: 'test@tempmail.com'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.validation.checks.disposableEmail).toBe(false);
    });

    it('should detect typo domains', async () => {
      const response = await request(app)
        .post('/api/validate-email')
        .set('X-API-Key', apiKey)
        .send({
          email: 'user@g-mail.com'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.validation.checks.typoDomain).toBe(false);
      expect(response.body.data.validation.suggestion).toBeDefined();
    });

    it('should handle international domain names', async () => {
      const response = await request(app)
        .post('/api/validate-email')
        .set('X-API-Key', apiKey)
        .send({
          email: 'test@münchen.de'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.validation.checks.internationalDomain).toBe(true);
    });

    it('should fail without API key', async () => {
      const response = await request(app)
        .post('/api/validate-email')
        .send({
          email: 'user@gmail.com'
        })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('API key required');
    });

    it('should fail with invalid API key', async () => {
      const response = await request(app)
        .post('/api/validate-email')
        .set('X-API-Key', 'invalid-api-key')
        .send({
          email: 'user@gmail.com'
        })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid API key');
    });
  });

  describe('POST /api/validate-emails', () => {
    it('should validate multiple emails in batch', async () => {
      const emails = [
        'user1@gmail.com',
        'user2@yahoo.com',
        'invalid-email',
        'test@temp-mail.com'
      ];

      const response = await request(app)
        .post('/api/validate-emails')
        .set('X-API-Key', apiKey)
        .send({ emails })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.results).toHaveLength(4);
      expect(response.body.data.summary.total).toBe(4);
      expect(response.body.data.summary.valid).toBeDefined();
      expect(response.body.data.summary.invalid).toBeDefined();
    });

    it('should handle empty email list', async () => {
      const response = await request(app)
        .post('/api/validate-emails')
        .set('X-API-Key', apiKey)
        .send({ emails: [] })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('At least one email is required');
    });

    it('should handle batch size limit', async () => {
      const emails = Array.from({ length: 15 }, (_, i) => `user${i}@gmail.com`);

      const response = await request(app)
        .post('/api/validate-emails')
        .set('X-API-Key', apiKey)
        .send({ emails })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Maximum 10 emails allowed per batch');
    });
  });

  describe('Concurrent Email Validation Test', () => {
    it('should handle multiple concurrent validation requests', async () => {
      const concurrentRequests = Array.from({ length: 20 }, (_, i) =>
        request(app)
          .post('/api/validate-email')
          .set('X-API-Key', apiKey)
          .send({
            email: `user${i}@gmail.com`
          })
      );

      const responses = await Promise.all(concurrentRequests);

      // All should succeed
      responses.forEach((response, index) => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.validation.email).toBe(`user${index}@gmail.com`);
      });
    });

    it('should handle concurrent batch validation requests', async () => {
      const batches = Array.from({ length: 5 }, (_, batchIndex) =>
        Array.from({ length: 5 }, (_, emailIndex) =>
          `batch${batchIndex}user${emailIndex}@gmail.com`
        )
      );

      const concurrentRequests = batches.map(emails =>
        request(app)
          .post('/api/validate-emails')
          .set('X-API-Key', apiKey)
          .send({ emails })
      );

      const responses = await Promise.all(concurrentRequests);

      // All batches should succeed
      responses.forEach((response, batchIndex) => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.results).toHaveLength(5);
        expect(response.body.data.summary.total).toBe(5);
      });
    });
  });

  describe('Performance Test - Email Validation Speed', () => {
    it('should validate emails within reasonable time limits', async () => {
      const startTime = Date.now();

      const response = await request(app)
        .post('/api/validate-emails')
        .set('X-API-Key', apiKey)
        .send({
          emails: [
            'user1@gmail.com',
            'user2@yahoo.com',
            'user3@hotmail.com',
            'user4@outlook.com',
            'user5@example.com'
          ]
        })
        .expect(200);

      const endTime = Date.now();
      const processingTime = endTime - startTime;

      expect(response.body.success).toBe(true);
      expect(processingTime).toBeLessThan(5000); // Should complete within 5 seconds
      expect(response.body.data.processingTime).toBeLessThan(5000);
    });
  });

  describe('Memory Usage Test', () => {
    it('should not leak memory during validation', async () => {
      const initialMemory = process.memoryUsage();

      // Perform many validations
      for (let i = 0; i < 100; i++) {
        await request(app)
          .post('/api/validate-email')
          .set('X-API-Key', apiKey)
          .send({
            email: `user${i}@gmail.com`
          });
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

      // Memory increase should be reasonable (less than 50MB)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    });
  });
});