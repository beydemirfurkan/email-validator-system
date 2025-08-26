import { db } from '../src/database/connection';
import { users, apiKeys, plans, contactLists } from '../src/database/schema';

// Test database setup
beforeAll(async () => {
  // Clean test database before all tests
  console.log('Setting up test database...');
  
  try {
    // Clear all tables in correct order (respecting foreign keys)
    await db.delete(contactLists);
    await db.delete(apiKeys);
    await db.delete(users);
    await db.delete(plans);
  } catch (error) {
    console.log('Database cleanup error (expected for first run):', error);
  }
});

afterAll(async () => {
  // Clean up after all tests
  console.log('Cleaning up test database...');
  
  try {
    // Clear all tables
    await db.delete(contactLists);
    await db.delete(apiKeys);
    await db.delete(users);
    await db.delete(plans);
  } catch (error) {
    console.log('Database cleanup error:', error);
  }
});

// Set test environment
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key';
process.env.DATABASE_URL = 'postgresql://localhost:5432/email_validator_test';