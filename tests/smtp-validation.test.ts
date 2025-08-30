/**
 * Comprehensive SMTP Verification Tests
 * Tests for SMTP email verification functionality with edge cases
 */

import { SMTPClient } from '../src/services/smtp/smtp-client.service';
import { SMTPConnectionPool, initializeConnectionPool, getGlobalConnectionPool, resetGlobalConnectionPool } from '../src/services/smtp/connection-pool.service';
import { SMTPVerificationService } from '../src/services/smtp/smtp-verification.service';
import { classifySmtpResponse, MESSAGE_PATTERNS } from '../src/services/smtp/message-analyzer.service';
import { EmailValidationService } from '../src/services/email-validation.service';

// Mock console methods to reduce test noise
const originalConsoleError = console.error;
const originalConsoleLog = console.log;
const originalConsoleWarn = console.warn;

beforeAll(() => {
  console.error = jest.fn();
  console.log = jest.fn();
  console.warn = jest.fn();
});

afterAll(() => {
  console.error = originalConsoleError;
  console.log = originalConsoleLog;
  console.warn = originalConsoleWarn;
});

describe('SMTP Client', () => {
  let client: SMTPClient;

  afterEach(() => {
    if (client) {
      client.close();
    }
  });

  describe('Constructor and Basic Operations', () => {
    test('should create SMTP client instance with default options', () => {
      client = new SMTPClient('smtp.example.com', 25);
      expect(client).toBeInstanceOf(SMTPClient);
    });

    test('should create SMTP client with custom options', () => {
      client = new SMTPClient('smtp.example.com', 587, {
        connectTimeout: 5000,
        readTimeout: 10000,
        verbose: true
      });
      expect(client).toBeInstanceOf(SMTPClient);
    });

    test('should handle invalid host gracefully', async () => {
      client = new SMTPClient('invalid.nonexistent.domain', 25, { 
        connectTimeout: 2000,
        verbose: false 
      });
      
      await expect(client.connect()).rejects.toThrow();
    }, 15000);
  });

  describe('Connection Handling', () => {
    test('should handle connection timeout', async () => {
      // Use a non-routable IP address that will cause timeout
      client = new SMTPClient('192.0.2.1', 25, { 
        connectTimeout: 1000,
        verbose: false 
      });
      
      await expect(client.connect()).rejects.toThrow('Connect timeout');
    }, 10000);

    test('should handle connection refused', async () => {
      // Use localhost on a port that's likely closed
      client = new SMTPClient('127.0.0.1', 9999, { 
        connectTimeout: 2000,
        verbose: false 
      });
      
      await expect(client.connect()).rejects.toThrow('Connection failed');
    }, 10000);

    test('should close connection properly', () => {
      client = new SMTPClient('smtp.example.com', 25);
      expect(() => client.close()).not.toThrow();
    });
  });

  describe('Command Handling', () => {
    test('should handle sendCommand when not connected', async () => {
      client = new SMTPClient('smtp.example.com', 25);
      await expect(client.sendCommand('NOOP')).rejects.toThrow('Not connected');
    });

    test('should handle write when not connected', async () => {
      client = new SMTPClient('smtp.example.com', 25);
      await expect(client.write('NOOP')).rejects.toThrow('Not connected');
    });
  });
});

describe('Connection Pool', () => {
  let pool: SMTPConnectionPool;

  afterEach(() => {
    if (pool) {
      pool.close();
    }
  });

  describe('Pool Creation and Configuration', () => {
    test('should create connection pool with default options', () => {
      pool = new SMTPConnectionPool();
      expect(pool).toBeInstanceOf(SMTPConnectionPool);
    });

    test('should create connection pool with custom options', () => {
      pool = new SMTPConnectionPool({
        maxConnectionsPerPool: 5,
        connectionTimeout: 10000,
        maxIdleTime: 120000,
        enablePooling: true
      });
      expect(pool).toBeInstanceOf(SMTPConnectionPool);
    });

    test('should disable pooling when configured', () => {
      pool = new SMTPConnectionPool({
        enablePooling: false
      });
      expect(pool).toBeInstanceOf(SMTPConnectionPool);
    });
  });

  describe('Pool Statistics and Management', () => {
    test('should return initial stats', () => {
      pool = new SMTPConnectionPool();
      const stats = pool.getStats();
      
      expect(stats).toHaveProperty('totalPools', 0);
      expect(stats).toHaveProperty('totalConnections', 0);
      expect(stats).toHaveProperty('availableConnections', 0);
      expect(stats).toHaveProperty('inUseConnections', 0);
    });

    test('should handle pool cleanup', () => {
      pool = new SMTPConnectionPool({
        maxIdleTime: 1000 // 1 second for testing
      });
      
      // Trigger cleanup manually (normally runs every 30 seconds)
      expect(() => (pool as any).cleanup()).not.toThrow();
    });

    test('should close all connections on pool close', () => {
      pool = new SMTPConnectionPool();
      expect(() => pool.close()).not.toThrow();
    });
  });

  describe('Global Connection Pool', () => {
    test('should initialize and retrieve global connection pool', () => {
      const globalPool = initializeConnectionPool({
        maxConnectionsPerPool: 2,
        enablePooling: true
      });
      
      expect(globalPool).toBeInstanceOf(SMTPConnectionPool);
      expect(getGlobalConnectionPool()).toBe(globalPool);
      
      globalPool.close();
    });

    test('should return null when no global pool initialized', () => {
      // Reset global pool properly
      resetGlobalConnectionPool();
      
      expect(getGlobalConnectionPool()).toBeNull();
    });
  });
});

describe('Message Analyzer', () => {
  describe('SMTP Response Classification', () => {
    test('should classify 2xx responses as valid', () => {
      const testCases = [
        { code: 200, expected: 'valid' },
        { code: 220, expected: 'valid' },
        { code: 250, expected: 'valid' },
        { code: 354, expected: 'valid' }
      ];

      testCases.forEach(({ code, expected }) => {
        const result = classifySmtpResponse(code, 'OK', 'Accepted');
        expect(result.result).toBe(expected);
        expect(result.smtp_code).toBe(code);
      });
    });

    test('should classify 4xx responses as unknown (temporary failures)', () => {
      const testCases = [
        { code: 421, reasonCode: 'service_unavailable' },
        { code: 450, reasonCode: 'mailbox_busy' },
        { code: 451, reasonCode: 'temporary_failure' },
        { code: 452, reasonCode: 'mailbox_full' },
        { code: 454, reasonCode: 'temporary_failure' }
      ];

      testCases.forEach(({ code, reasonCode }) => {
        const result = classifySmtpResponse(code, 'Temporary failure', 'Rejected');
        expect(result.result).toBe('unknown');
        expect(result.reason_code).toBe(reasonCode);
        expect(result.smtp_code).toBe(code);
      });
    });

    test('should classify 5xx responses as invalid (permanent failures)', () => {
      const testCases = [
        { code: 550, message: 'User unknown', reasonCode: 'invalid_user' },
        { code: 550, message: 'Relay denied', reasonCode: 'relay_denied' },
        { code: 551, message: 'User not local', reasonCode: 'user_not_local' },
        { code: 552, message: 'Mailbox full', reasonCode: 'mailbox_full' },
        { code: 553, message: 'Invalid address', reasonCode: 'invalid_address_syntax' },
        { code: 554, message: 'Server reject', reasonCode: 'server_reject' }
      ];

      testCases.forEach(({ code, message, reasonCode }) => {
        const result = classifySmtpResponse(code, message, 'Rejected');
        expect(result.result).toBe('invalid');
        expect(result.reason_code).toBe(reasonCode);
        expect(result.smtp_code).toBe(code);
      });
    });

    test('should detect greylisting correctly', () => {
      const greylistMessages = [
        'Greylisted, please try again later',
        'Graylisted for policy reasons',
        'Try again later',
        'Please retry in a few minutes'
      ];

      greylistMessages.forEach(message => {
        const result = classifySmtpResponse(451, message, 'Rejected');
        expect(result.result).toBe('unknown');
        expect(result.reason_code).toBe('greylisted');
      });
    });
  });

  describe('Message Pattern Analysis', () => {
    test('should detect blocked patterns', () => {
      const blockedMessages = [
        'Your IP is blocked due to spam',
        'Blacklisted sender',
        'Reputation too low',
        'Policy violation detected'
      ];

      blockedMessages.forEach(message => {
        const result = classifySmtpResponse(554, message, 'Rejected');
        expect(result.message_analysis).toBeDefined();
        expect(result.message_analysis?.severity).toBe('high');
        expect(result.server_hint).toBe('ip_rotation');
      });
    });

    test('should detect rate limiting patterns', () => {
      const rateLimitMessages = [
        'Rate limit exceeded',
        'Too many connections',
        'Throttle limit reached',
        'Slow down, too frequent requests'
      ];

      rateLimitMessages.forEach(message => {
        const result = classifySmtpResponse(451, message, 'Rejected');
        expect(result.message_analysis).toBeDefined();
        expect(result.message_analysis?.severity).toBe('medium');
        expect(result.server_hint).toBe('delay_and_retry');
      });
    });

    test('should handle messages without special patterns', () => {
      const normalMessage = 'Standard rejection message';
      const result = classifySmtpResponse(550, normalMessage, 'Rejected');
      expect(result.message_analysis).toBeUndefined();
      expect(result.server_hint).toBeUndefined();
    });
  });

  describe('Pattern Configuration', () => {
    test('should have all expected message pattern categories', () => {
      const expectedCategories = [
        'blocked',
        'rate_limited',
        'greylisted',
        'connection_issues',
        'server_busy',
        'authentication_issues'
      ];

      expectedCategories.forEach(category => {
        expect(MESSAGE_PATTERNS).toHaveProperty(category);
        expect(MESSAGE_PATTERNS[category]).toHaveProperty('patterns');
        expect(MESSAGE_PATTERNS[category]).toHaveProperty('severity');
        expect(MESSAGE_PATTERNS[category]).toHaveProperty('action');
      });
    });
  });
});

describe('SMTP Verification Service', () => {
  let service: SMTPVerificationService;

  beforeEach(() => {
    service = new SMTPVerificationService();
  });

  describe('Service Creation', () => {
    test('should create verification service instance', () => {
      expect(service).toBeInstanceOf(SMTPVerificationService);
    });
  });

  describe('Email Format Validation', () => {
    test('should handle invalid email formats', async () => {
      const invalidEmails = [
        'invalid-email',
        'test@',
        '@domain.com',
        'test..test@domain.com',
        'test@domain',
        ''
      ];

      for (const email of invalidEmails) {
        const result = await service.verifyEmail(email);
        expect(result.valid).toBe(false);
        expect(result.reason).toContain('Invalid email format');
      }
    }, 15000);

    test('should handle valid email formats', async () => {
      const validEmails = [
        'test@example.com',
        'user.name@domain.org',
        'user+tag@domain.co.uk'
      ];

      for (const email of validEmails) {
        const result = await service.verifyEmail(email);
        // May fail due to no MX records, but format should be accepted
        expect(result.email).toBe(email);
      }
    }, 15000);
  });

  describe('MX Record Resolution', () => {
    test('should resolve MX records for valid domains', async () => {
      const validDomains = ['gmail.com', 'outlook.com', 'yahoo.com'];

      for (const domain of validDomains) {
        const mxRecords = await service.resolveMxRecords(domain);
        expect(mxRecords.length).toBeGreaterThan(0);
        expect(mxRecords[0]).toHaveProperty('exchange');
        expect(mxRecords[0]).toHaveProperty('priority');
        expect(typeof mxRecords[0].priority).toBe('number');
        expect(typeof mxRecords[0].exchange).toBe('string');
      }
    }, 30000);

    test('should handle domains without MX records', async () => {
      const invalidDomains = [
        'nonexistentdomain12345.com',
        'invalid.invalid.invalid',
        'totally-fake-domain.xyz'
      ];

      for (const domain of invalidDomains) {
        await expect(service.resolveMxRecords(domain))
          .rejects.toThrow('No MX or A records found');
      }
    }, 20000);

    test('should sort MX records by priority', async () => {
      const mxRecords = await service.resolveMxRecords('gmail.com');
      
      if (mxRecords.length > 1) {
        for (let i = 1; i < mxRecords.length; i++) {
          expect(mxRecords[i].priority).toBeGreaterThanOrEqual(mxRecords[i - 1].priority);
        }
      }
    }, 15000);
  });

  describe('End-to-End Email Verification', () => {
    test('should handle complete verification flow for invalid domains', async () => {
      const result = await service.verifyEmail('test@nonexistentdomain12345.com');
      expect(result.valid).toBe(false);
      expect(result.reason).toMatch(/MX|records/i);
    }, 15000);

    test('should provide comprehensive verification results', async () => {
      const result = await service.verifyEmail('test@gmail.com', {
        verbose: false,
        maxRetries: 1
      });

      expect(result).toHaveProperty('email');
      expect(result).toHaveProperty('valid');
      expect(result).toHaveProperty('result');
      expect(result).toHaveProperty('reason');
      
      if (result.mxRecords) {
        expect(Array.isArray(result.mxRecords)).toBe(true);
      }
    }, 30000);
  });

  describe('Configuration Options', () => {
    test('should respect custom verification options', async () => {
      const customOptions = {
        heloDomain: 'custom.example.com',
        from: 'custom@example.com',
        maxRetries: 1,
        verbose: false,
        starttls: 'auto' as const
      };

      const result = await service.verifyEmail('test@nonexistent.domain', customOptions);
      expect(result.valid).toBe(false);
      // Should fail quickly due to maxRetries: 1
    }, 10000);

    test('should handle different STARTTLS modes', async () => {
      const modes = ['on', 'off', 'auto'] as const;
      
      for (const starttls of modes) {
        const result = await service.verifyEmail('test@nonexistent.domain', {
          starttls,
          maxRetries: 0
        });
        expect(result).toHaveProperty('valid');
      }
    }, 15000);
  });
});

describe('EmailValidationService Integration', () => {
  let emailService: EmailValidationService;

  beforeEach(() => {
    emailService = new EmailValidationService({
      batchSize: 5,
      enableSmtpValidation: true
    });
  });

  describe('SMTP Integration', () => {
    test('should create service with SMTP validation enabled', () => {
      expect(emailService).toBeInstanceOf(EmailValidationService);
    });

    test('should handle SMTP validation in validation pipeline', async () => {
      // Test with a domain that has MX records but likely invalid email
      const result = await emailService.validateSingle('nonexistentuser12345@gmail.com');
      
      expect(result).toHaveProperty('valid');
      expect(result).toHaveProperty('details');
      expect(result.details).toHaveProperty('smtp');
      expect(result).toHaveProperty('processingTime');
      
      // Should have gone through all validation layers
      expect(result.details.format).toBe(true);
      expect(result.details.mx).toBe(true);
    }, 30000);

    test('should handle SMTP validation disabled', async () => {
      const serviceWithoutSMTP = new EmailValidationService({
        batchSize: 5,
        enableSmtpValidation: false
      });

      const result = await serviceWithoutSMTP.validateSingle('test@gmail.com');
      
      expect(result).toHaveProperty('valid');
      expect(result.details.smtp).toBe(true); // Should default to true when disabled
    }, 10000);
  });

  describe('Error Handling', () => {
    test('should gracefully handle SMTP verification failures', async () => {
      // This should not crash the entire validation even if SMTP fails
      const result = await emailService.validateSingle('test@gmail.com');
      
      expect(result).toHaveProperty('valid');
      expect(result).toHaveProperty('reason');
      expect(Array.isArray(result.reason)).toBe(true);
    }, 30000);
  });
});

describe('Performance and Reliability', () => {
  describe('Concurrent Operations', () => {
    test('should handle multiple concurrent verifications', async () => {
      const service = new SMTPVerificationService();
      const emails = [
        'test1@nonexistent.domain',
        'test2@nonexistent.domain',
        'test3@nonexistent.domain'
      ];

      const promises = emails.map(email => 
        service.verifyEmail(email, { maxRetries: 0 })
      );

      const results = await Promise.allSettled(promises);
      
      expect(results.length).toBe(emails.length);
      results.forEach(result => {
        expect(result.status).toBe('fulfilled');
        if (result.status === 'fulfilled') {
          expect(result.value).toHaveProperty('valid');
        }
      });
    }, 20000);
  });

  describe('Resource Management', () => {
    test('should properly clean up resources', () => {
      const pool = new SMTPConnectionPool();
      const stats = pool.getStats();
      
      expect(stats.totalPools).toBe(0);
      expect(stats.totalConnections).toBe(0);
      
      // Close should not throw
      expect(() => pool.close()).not.toThrow();
    });
  });
});

describe('Edge Cases and Error Scenarios', () => {
  describe('Network Issues', () => {
    test('should handle DNS resolution failures gracefully', async () => {
      const service = new SMTPVerificationService();
      const result = await service.verifyEmail('test@invalid.invalid.invalid');
      
      expect(result.valid).toBe(false);
      expect(result.reason).toBeDefined();
    }, 10000);
  });

  describe('Malformed Inputs', () => {
    test('should handle empty and whitespace emails', async () => {
      const service = new SMTPVerificationService();
      const testInputs = ['', ' ', '\t', '\n'];
      
      for (const input of testInputs) {
        const result = await service.verifyEmail(input);
        expect(result.valid).toBe(false);
      }
    });
  });
});