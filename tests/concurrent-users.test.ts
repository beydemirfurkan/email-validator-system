import request from 'supertest';
import app from '../src/app';
import { db } from '../src/database/connection';
import { users, apiKeys, contactLists } from '../src/database/schema';

describe('Concurrent Users Simulation Tests', () => {
  const CONCURRENT_USERS = 50;
  const OPERATIONS_PER_USER = 20;

  beforeAll(async () => {
    // Clean database
    await db.delete(contactLists);
    await db.delete(apiKeys);
    await db.delete(users);
  });

  describe('Concurrent User Registration and Operations', () => {
    it('should handle multiple users registering and using the system simultaneously', async () => {
      console.log(`🚀 Simulating ${CONCURRENT_USERS} concurrent users...`);
      
      const startTime = Date.now();
      
      // Create concurrent user sessions
      const userSessions = Array.from({ length: CONCURRENT_USERS }, (_, i) => ({
        userId: i,
        name: `ConcurrentUser${i}`,
        email: `user${i}@concurrenttest.com`,
        password: 'TestPassword123!'
      }));

      // Register all users concurrently
      const registrationPromises = userSessions.map(user =>
        request(app)
          .post('/api/auth/register')
          .send(user)
      );

      const registrationResults = await Promise.all(registrationPromises);

      // Verify all registrations succeeded
      registrationResults.forEach((response, index) => {
        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
        expect(response.body.data.user.email).toBe(userSessions[index].email);
      });

      const registrationTime = Date.now() - startTime;
      console.log(`✅ ${CONCURRENT_USERS} users registered in ${registrationTime}ms`);

      // Extract tokens and user data
      const userTokens = registrationResults.map((response, index) => ({
        ...userSessions[index],
        token: response.body.data.token,
        userId: response.body.data.user.id
      }));

      // Phase 2: Each user creates API key
      console.log('🔑 Creating API keys for all users...');
      
      const apiKeyPromises = userTokens.map(user =>
        request(app)
          .post('/api/keys')
          .set('Authorization', `Bearer ${user.token}`)
          .send({
            keyName: `API Key for ${user.name}`,
            rateLimit: 100
          })
      );

      const apiKeyResults = await Promise.all(apiKeyPromises);
      
      apiKeyResults.forEach((response, index) => {
        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
      });

      // Extract API keys
      const usersWithApiKeys = userTokens.map((user, index) => ({
        ...user,
        apiKey: apiKeyResults[index].body.data.apiKey.apiKey
      }));

      const apiKeyTime = Date.now() - startTime - registrationTime;
      console.log(`✅ ${CONCURRENT_USERS} API keys created in ${apiKeyTime}ms`);

      // Phase 3: Concurrent email validations
      console.log(`📧 Performing ${OPERATIONS_PER_USER} email validations per user...`);
      
      const validationPromises = [];
      
      usersWithApiKeys.forEach(user => {
        for (let i = 0; i < OPERATIONS_PER_USER; i++) {
          validationPromises.push(
            request(app)
              .post('/api/validate-email')
              .set('X-API-Key', user.apiKey)
              .send({
                email: `validation${i}@user${user.userId}test.com`
              })
          );
        }
      });

      const validationResults = await Promise.all(validationPromises);
      
      // Verify all validations
      let successfulValidations = 0;
      validationResults.forEach(response => {
        if (response.status === 200 && response.body.success) {
          successfulValidations++;
        }
      });

      const totalExpectedValidations = CONCURRENT_USERS * OPERATIONS_PER_USER;
      const validationTime = Date.now() - startTime - registrationTime - apiKeyTime;
      
      console.log(`✅ ${successfulValidations}/${totalExpectedValidations} validations completed in ${validationTime}ms`);
      
      expect(successfulValidations).toBeGreaterThan(totalExpectedValidations * 0.95); // 95% success rate
      
      const totalTime = Date.now() - startTime;
      console.log(`🏁 Total test time: ${totalTime}ms`);
      console.log(`📊 Average time per user: ${(totalTime / CONCURRENT_USERS).toFixed(2)}ms`);
      console.log(`📊 Validations per second: ${(successfulValidations / (totalTime / 1000)).toFixed(2)}`);

    }, 120000); // 2 minute timeout
  });

  describe('Database Stress Test - Concurrent Operations', () => {
    it('should handle concurrent database operations without deadlocks', async () => {
      console.log('🗃️  Testing concurrent database operations...');
      
      // Register users for database stress test
      const dbUsers = [];
      for (let i = 0; i < 20; i++) {
        const response = await request(app)
          .post('/api/auth/register')
          .send({
            name: `DBUser${i}`,
            email: `dbuser${i}@test.com`,
            password: 'TestPassword123!'
          });
        
        dbUsers.push({
          token: response.body.data.token,
          userId: response.body.data.user.id
        });
      }

      // Concurrent operations mixing reads and writes
      const concurrentOperations = [];
      
      dbUsers.forEach((user, index) => {
        // Create contact list
        concurrentOperations.push(
          request(app)
            .post('/api/contact-lists')
            .set('Authorization', `Bearer ${user.token}`)
            .send({
              name: `List ${index}`,
              description: `Contact list for user ${index}`
            })
        );

        // Get user profile (read operation)
        concurrentOperations.push(
          request(app)
            .get('/api/auth/profile')
            .set('Authorization', `Bearer ${user.token}`)
        );

        // Get analytics dashboard (complex read)
        concurrentOperations.push(
          request(app)
            .get('/api/analytics/dashboard')
            .set('Authorization', `Bearer ${user.token}`)
        );
      });

      const startTime = Date.now();
      const results = await Promise.all(concurrentOperations);
      const endTime = Date.now();

      // Verify no deadlocks or major failures
      let successCount = 0;
      results.forEach(response => {
        if (response.status < 500) { // Accept 4xx but not 5xx errors
          successCount++;
        }
      });

      const successRate = (successCount / results.length) * 100;
      console.log(`✅ Database operations: ${successCount}/${results.length} successful (${successRate.toFixed(2)}%)`);
      console.log(`⏱️  Total time: ${endTime - startTime}ms`);

      expect(successRate).toBeGreaterThan(90); // 90% success rate for database operations
    });
  });

  describe('Memory Usage Under Load', () => {
    it('should not have memory leaks during concurrent operations', async () => {
      const initialMemory = process.memoryUsage();
      console.log('🧠 Initial memory usage:', {
        rss: Math.round(initialMemory.rss / 1024 / 1024) + 'MB',
        heapUsed: Math.round(initialMemory.heapUsed / 1024 / 1024) + 'MB'
      });

      // Perform intensive operations
      const operations = [];
      
      for (let i = 0; i < 100; i++) {
        operations.push(
          request(app)
            .post('/api/auth/register')
            .send({
              name: `MemoryUser${i}`,
              email: `memuser${i}@test.com`,
              password: 'TestPassword123!'
            })
            .then(response => {
              if (response.body.data?.token) {
                return request(app)
                  .post('/api/keys')
                  .set('Authorization', `Bearer ${response.body.data.token}`)
                  .send({
                    keyName: `Memory Test Key ${i}`,
                    rateLimit: 100
                  });
              }
            })
        );
      }

      await Promise.all(operations);

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
        global.gc(); // Run twice to be thorough
      }

      // Wait a bit for cleanup
      await new Promise(resolve => setTimeout(resolve, 2000));

      const finalMemory = process.memoryUsage();
      console.log('🧠 Final memory usage:', {
        rss: Math.round(finalMemory.rss / 1024 / 1024) + 'MB',
        heapUsed: Math.round(finalMemory.heapUsed / 1024 / 1024) + 'MB'
      });

      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      const memoryIncreaseMB = Math.round(memoryIncrease / 1024 / 1024);
      
      console.log(`📊 Memory increase: ${memoryIncreaseMB}MB`);

      // Memory increase should be reasonable (less than 100MB for this test)
      expect(memoryIncreaseMB).toBeLessThan(100);
    });
  });

  describe('Rate Limiting Under Concurrent Load', () => {
    it('should properly handle rate limiting with multiple concurrent users', async () => {
      // Create a user with low rate limit
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'RateLimit User',
          email: 'ratelimit@test.com',
          password: 'TestPassword123!'
        });

      const token = response.body.data.token;

      // Create API key with low rate limit
      const apiKeyResponse = await request(app)
        .post('/api/keys')
        .set('Authorization', `Bearer ${token}`)
        .send({
          keyName: 'Rate Limited Key',
          rateLimit: 10 // Very low limit
        });

      const apiKey = apiKeyResponse.body.data.apiKey.apiKey;

      // Spam requests to trigger rate limiting
      const spamRequests = Array.from({ length: 50 }, () =>
        request(app)
          .post('/api/validate-email')
          .set('X-API-Key', apiKey)
          .send({
            email: 'spam@test.com'
          })
      );

      const results = await Promise.all(spamRequests);

      // Count successful and rate-limited requests
      let successCount = 0;
      let rateLimitedCount = 0;

      results.forEach(result => {
        if (result.status === 200) {
          successCount++;
        } else if (result.status === 429) {
          rateLimitedCount++;
        }
      });

      console.log(`✅ Successful requests: ${successCount}`);
      console.log(`🚫 Rate limited requests: ${rateLimitedCount}`);

      // Should have some rate limited requests
      expect(rateLimitedCount).toBeGreaterThan(0);
      expect(successCount).toBeLessThanOrEqual(15); // Allow some buffer
    });
  });

  describe('Error Handling Under Load', () => {
    it('should gracefully handle errors during concurrent operations', async () => {
      const operations = [];
      
      // Mix of valid and invalid operations
      for (let i = 0; i < 30; i++) {
        // Valid registration
        operations.push(
          request(app)
            .post('/api/auth/register')
            .send({
              name: `ErrorUser${i}`,
              email: `erroruser${i}@test.com`,
              password: 'TestPassword123!'
            })
        );

        // Invalid registration (bad email)
        operations.push(
          request(app)
            .post('/api/auth/register')
            .send({
              name: `BadUser${i}`,
              email: 'invalid-email',
              password: 'TestPassword123!'
            })
        );

        // Invalid API call (no auth)
        operations.push(
          request(app)
            .get('/api/auth/profile')
            // No authorization header
        );
      }

      const results = await Promise.all(operations);

      // Categorize responses
      const statusCounts = {};
      results.forEach(result => {
        statusCounts[result.status] = (statusCounts[result.status] || 0) + 1;
      });

      console.log('📊 Response status distribution:', statusCounts);

      // Should have a mix of success and error responses
      expect(statusCounts[201]).toBeDefined(); // Successful registrations
      expect(statusCounts[400]).toBeDefined(); // Bad requests
      expect(statusCounts[401]).toBeDefined(); // Unauthorized

      // No server errors should occur
      expect(statusCounts[500] || 0).toBe(0);
    });
  });
});