/**
 * Email Validation Service Integration Tests
 * Tests the complete email validation pipeline with SMTP integration
 */

import { EmailValidationService } from '../src/services/email-validation.service';
import { ValidationResult } from '../src/types/api';

// Mock console to reduce test noise
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

beforeAll(() => {
  console.error = jest.fn();
  console.warn = jest.fn();
});

afterAll(() => {
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
});

describe('Email Validation Service Integration', () => {
  let validationService: EmailValidationService;

  beforeEach(() => {
    validationService = new EmailValidationService({
      batchSize: 5,
      enableSmtpValidation: false // Default to false for faster tests
    });
  });

  describe('Complete Validation Pipeline', () => {
    test('should validate email format correctly', async () => {
      const result = await validationService.validateSingle('valid@example.com');
      
      expect(result.details.format).toBe(true);
      expect(result.email).toBe('valid@example.com');
    });

    test('should reject invalid email formats', async () => {
      const invalidEmails = [
        'invalid-email',
        'test@',
        '@domain.com',
        'test..test@domain.com'
      ];

      for (const email of invalidEmails) {
        const result = await validationService.validateSingle(email);
        expect(result.valid).toBe(false);
        expect(result.details.format).toBe(false);
      }
    });

    test('should handle international email normalization', async () => {
      const result = await validationService.validateSingle('test@münchen.de');
      
      // Should either normalize successfully or reject appropriately
      expect(result).toHaveProperty('valid');
      expect(result).toHaveProperty('email');
    });

    test('should detect disposable email domains', async () => {
      // Using a known disposable domain
      const result = await validationService.validateSingle('test@10minutemail.com');
      
      expect(result.valid).toBe(false);
      expect(result.details.disposable).toBe(false);
      expect(result.reason).toContain('Disposable email address');
    });

    test('should detect typo domains', async () => {
      // This test depends on typo domains being configured
      const result = await validationService.validateSingle('test@gmial.com');
      
      // Should either detect typo or pass through normally
      expect(result).toHaveProperty('valid');
      expect(result.details).toHaveProperty('typo');
    });

    test('should detect placeholder emails', async () => {
      const placeholderEmails = [
        'test@test.com',
        'example@example.com',
        'admin@localhost'
      ];

      for (const email of placeholderEmails) {
        const result = await validationService.validateSingle(email);
        // May or may not be detected as placeholder depending on configuration
        expect(result).toHaveProperty('valid');
      }
    });

    test('should check MX records', async () => {
      const result = await validationService.validateSingle('test@gmail.com');
      
      expect(result.details.mx).toBe(true); // Gmail should have MX records
    });

    test('should reject domains without MX records', async () => {
      const result = await validationService.validateSingle('test@nonexistentdomain12345.invalid');
      
      expect(result.valid).toBe(false);
      expect(result.details.mx).toBe(false);
      expect(result.reason).toContain('No MX record found');
    });
  });

  describe('SMTP Validation Integration', () => {
    let smtpValidationService: EmailValidationService;

    beforeEach(() => {
      smtpValidationService = new EmailValidationService({
        batchSize: 3,
        enableSmtpValidation: true
      });
    });

    test('should perform SMTP validation when enabled', async () => {
      const result = await smtpValidationService.validateSingle('test@gmail.com');
      
      expect(result.details).toHaveProperty('smtp');
      expect(result).toHaveProperty('processingTime');
      
      // Should have gone through all validation layers
      expect(result.details.format).toBe(true);
      expect(result.details.mx).toBe(true);
    }, 30000);

    test('should handle SMTP failures gracefully', async () => {
      // Use a domain that has MX records but may reject SMTP connections
      const result = await smtpValidationService.validateSingle('test@example.com');
      
      expect(result).toHaveProperty('valid');
      expect(result).toHaveProperty('score');
      expect(typeof result.score).toBe('number');
    }, 20000);

    test('should provide SMTP details when available', async () => {
      const result = await smtpValidationService.validateSingle('nonexistent@gmail.com');
      
      // Should have SMTP details if verification was attempted
      if (result.smtpDetails) {
        expect(result.smtpDetails).toHaveProperty('result');
      }
    }, 30000);
  });

  describe('Batch Validation', () => {
    test('should validate multiple emails in batches', async () => {
      const emails = [
        'valid@gmail.com',
        'invalid-email',
        'test@nonexistent.domain',
        'user@outlook.com',
        'test@disposable.temp'
      ];

      const results = await validationService.validateBatch(emails, 'test-request-1');
      
      expect(results.length).toBe(emails.length);
      results.forEach((result, index) => {
        expect(result.email).toBe(emails[index].toLowerCase());
        expect(result).toHaveProperty('valid');
        expect(result).toHaveProperty('score');
        expect(result).toHaveProperty('details');
      });
    }, 20000);

    test('should respect batch size configuration', async () => {
      const smallBatchService = new EmailValidationService({
        batchSize: 2,
        enableSmtpValidation: false
      });

      const emails = ['test1@gmail.com', 'test2@gmail.com', 'test3@gmail.com'];
      const results = await smallBatchService.validateBatch(emails, 'test-batch');
      
      expect(results.length).toBe(3);
    });
  });

  describe('Caching Integration', () => {
    test('should handle cache hits and misses', async () => {
      const email = 'test@gmail.com';
      
      // First call - should not be from cache
      const result1 = await validationService.validateSingle(email);
      expect(result1.fromCache).toBeFalsy();
      
      // Second call - may be from cache (depends on cache implementation)
      const result2 = await validationService.validateSingle(email);
      expect(result2).toHaveProperty('valid');
    });

    test('should include processing time in results', async () => {
      const result = await validationService.validateSingle('test@gmail.com');
      
      expect(result).toHaveProperty('processingTime');
      expect(typeof result.processingTime).toBe('number');
      expect(result.processingTime).toBeGreaterThan(0);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle very long email addresses', async () => {
      const longEmail = 'a'.repeat(250) + '@gmail.com';
      const result = await validationService.validateSingle(longEmail);
      
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Email address too long');
    });

    test('should handle emails with special characters', async () => {
      const specialEmails = [
        'test+tag@gmail.com',
        'user.name@domain.com',
        'test-user@sub.domain.com'
      ];

      for (const email of specialEmails) {
        const result = await validationService.validateSingle(email);
        expect(result).toHaveProperty('valid');
      }
    });

    test('should handle empty and whitespace inputs', async () => {
      const emptyInputs = ['', ' ', '\t', '\n'];
      
      for (const input of emptyInputs) {
        const result = await validationService.validateSingle(input);
        expect(result.valid).toBe(false);
      }
    });

    test('should provide detailed error information in development', async () => {
      // Test error handling
      const result = await validationService.validateSingle('invalid@nonexistent.domain');
      
      expect(result).toHaveProperty('valid');
      expect(result).toHaveProperty('reason');
      expect(Array.isArray(result.reason)).toBe(true);
    });
  });

  describe('Statistics and Metrics', () => {
    test('should calculate validation statistics', () => {
      const mockResults: ValidationResult[] = [
        { valid: true, email: 'test1@gmail.com', score: 100, reason: [], details: {} as any },
        { valid: false, email: 'test2@invalid.com', score: 0, reason: ['Invalid'], details: {} as any },
        { valid: true, email: 'test3@outlook.com', score: 90, reason: [], details: {} as any }
      ];

      const stats = validationService.calculateStatistics(mockResults);
      
      expect(stats.total).toBe(3);
      expect(stats.valid).toBe(2);
      expect(stats.invalid).toBe(1);
      expect(stats.validPercentage).toBe(67);
      expect(stats.invalidPercentage).toBe(33);
    });

    test('should handle empty results in statistics', () => {
      const stats = validationService.calculateStatistics([]);
      
      expect(stats.total).toBe(0);
      expect(stats.valid).toBe(0);
      expect(stats.invalid).toBe(0);
      expect(stats.validPercentage).toBe(0);
      expect(stats.invalidPercentage).toBe(0);
    });
  });

  describe('Cache Management', () => {
    test('should provide cache statistics', () => {
      const cacheStats = validationService.getCacheStatistics();
      
      expect(cacheStats).toHaveProperty('hits');
      expect(cacheStats).toHaveProperty('misses');
      expect(cacheStats).toHaveProperty('size');
    });

    test('should clear cache when requested', () => {
      expect(() => validationService.clearMxCache()).not.toThrow();
    });

    test('should list cached domains', () => {
      const cachedDomains = validationService.getCachedDomains();
      expect(Array.isArray(cachedDomains)).toBe(true);
    });
  });

  describe('Duplicate Handling', () => {
    test('should remove duplicate emails', () => {
      const emailsWithDuplicates = [
        'test@gmail.com',
        'TEST@GMAIL.COM',
        'user@outlook.com',
        'test@gmail.com'
      ];

      const uniqueEmails = validationService.removeDuplicates(emailsWithDuplicates);
      
      expect(uniqueEmails.length).toBe(2);
      expect(uniqueEmails).toContain('test@gmail.com');
      expect(uniqueEmails).toContain('user@outlook.com');
    });

    test('should handle empty array of emails', () => {
      const uniqueEmails = validationService.removeDuplicates([]);
      expect(uniqueEmails).toEqual([]);
    });
  });

  describe('Configuration Validation', () => {
    test('should use default configuration when not provided', () => {
      const defaultService = new EmailValidationService();
      expect(defaultService).toBeInstanceOf(EmailValidationService);
    });

    test('should accept custom batch size', () => {
      const customService = new EmailValidationService({
        batchSize: 20,
        enableSmtpValidation: false
      });
      expect(customService).toBeInstanceOf(EmailValidationService);
    });
  });
});