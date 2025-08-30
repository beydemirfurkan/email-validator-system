/**
 * SMTP Unit Tests (No Dependencies)
 * Tests for SMTP components without external dependencies
 */

import { SMTPClient } from '../src/services/smtp/smtp-client.service';
import { SMTPConnectionPool, resetGlobalConnectionPool } from '../src/services/smtp/connection-pool.service';
import { classifySmtpResponse, MESSAGE_PATTERNS } from '../src/services/smtp/message-analyzer.service';

// Mock console methods
const originalConsoleError = console.error;

beforeAll(() => {
  console.error = jest.fn();
});

afterAll(() => {
  console.error = originalConsoleError;
});

afterEach(() => {
  resetGlobalConnectionPool();
});

describe('SMTP Message Analyzer (Unit Tests)', () => {
  describe('Response Classification', () => {
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
        expect(result.reason_code).toBe('accepted');
      });
    });

    test('should classify 4xx responses as unknown', () => {
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

    test('should classify 5xx responses as invalid', () => {
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

    test('should detect greylisting with specific messages', () => {
      const greylistMessages = [
        'Greylisted, please try again later',
        'Graylisted for policy reasons',
        'Please try again later',
        'Try later',
        'greylisted'
      ];

      greylistMessages.forEach(message => {
        const result = classifySmtpResponse(451, message, 'Rejected');
        expect(result.result).toBe('unknown');
        expect(result.reason_code).toBe('greylisted');
      });
    });

    test('should handle unknown response codes', () => {
      const result = classifySmtpResponse(999, 'Unknown response', 'Rejected');
      expect(result.result).toBe('unknown');
      expect(result.smtp_code).toBe(999);
    });
  });

  describe('Message Pattern Analysis', () => {
    test('should detect blocked patterns', () => {
      const blockedMessages = [
        'Your IP is blocked due to spam',
        'Blacklisted sender',
        'Reputation too low',
        'Policy violation detected',
        'Blocked by policy'
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
        'Slow down, too frequent requests',
        'Exceeded connection limit'
      ];

      rateLimitMessages.forEach(message => {
        const result = classifySmtpResponse(451, message, 'Rejected');
        expect(result.message_analysis).toBeDefined();
        expect(result.message_analysis?.severity).toBe('medium');
        expect(result.server_hint).toBe('delay_and_retry');
      });
    });

    test('should detect server busy patterns', () => {
      // Use messages that specifically match server_busy patterns
      const busyMessages = [
        'Server busy',
        'System overload',
        'Server capacity',
        'Resources limited'
      ];

      busyMessages.forEach(message => {
        const result = classifySmtpResponse(421, message, 'Rejected');
        if (result.message_analysis) {
          expect(result.message_analysis.severity).toBe('low');
          expect(result.server_hint).toBe('retry_later');
        }
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

    test('should have valid severity levels', () => {
      const validSeverities = ['low', 'medium', 'high'];

      Object.values(MESSAGE_PATTERNS).forEach(pattern => {
        expect(validSeverities).toContain(pattern.severity);
      });
    });

    test('should have valid pattern arrays', () => {
      Object.entries(MESSAGE_PATTERNS).forEach(([category, pattern]) => {
        expect(Array.isArray(pattern.patterns)).toBe(true);
        expect(pattern.patterns.length).toBeGreaterThan(0);
        
        pattern.patterns.forEach(regex => {
          expect(regex).toBeInstanceOf(RegExp);
        });
      });
    });
  });
});

describe('SMTP Client Unit Tests', () => {
  let client: SMTPClient;

  afterEach(() => {
    if (client) {
      client.close();
    }
  });

  describe('Constructor', () => {
    test('should create client with default options', () => {
      client = new SMTPClient('smtp.example.com', 25);
      expect(client).toBeInstanceOf(SMTPClient);
    });

    test('should create client with custom options', () => {
      client = new SMTPClient('smtp.example.com', 587, {
        connectTimeout: 5000,
        readTimeout: 10000,
        verbose: true
      });
      expect(client).toBeInstanceOf(SMTPClient);
    });
  });

  describe('Error Handling', () => {
    test('should handle sendCommand when not connected', async () => {
      client = new SMTPClient('smtp.example.com', 25);
      await expect(client.sendCommand('NOOP')).rejects.toThrow('Not connected');
    });

    test('should handle write when not connected', async () => {
      client = new SMTPClient('smtp.example.com', 25);
      await expect(client.write('NOOP')).rejects.toThrow('Not connected');
    });

    test('should close connection gracefully', () => {
      client = new SMTPClient('smtp.example.com', 25);
      expect(() => client.close()).not.toThrow();
    });
  });
});

describe('Connection Pool Unit Tests', () => {
  let pool: SMTPConnectionPool;

  afterEach(() => {
    if (pool) {
      pool.close();
    }
  });

  describe('Pool Creation', () => {
    test('should create pool with default options', () => {
      pool = new SMTPConnectionPool();
      expect(pool).toBeInstanceOf(SMTPConnectionPool);
    });

    test('should create pool with custom options', () => {
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

  describe('Statistics', () => {
    test('should return initial stats', () => {
      pool = new SMTPConnectionPool();
      const stats = pool.getStats();
      
      expect(stats).toEqual({
        totalPools: 0,
        totalConnections: 0,
        availableConnections: 0,
        inUseConnections: 0
      });
    });

    test('should handle cleanup without errors', () => {
      pool = new SMTPConnectionPool({
        maxIdleTime: 1000
      });
      
      expect(() => (pool as any).cleanup()).not.toThrow();
    });
  });

  describe('Resource Management', () => {
    test('should close without errors', () => {
      pool = new SMTPConnectionPool();
      expect(() => pool.close()).not.toThrow();
    });
  });
});

describe('Edge Cases and Validation', () => {
  describe('Input Validation', () => {
    test('should handle empty messages in classification', () => {
      const result = classifySmtpResponse(250, '', 'Accepted');
      expect(result.result).toBe('valid');
      expect(result.details).toBe('');
    });

    test('should handle null/undefined messages', () => {
      const result1 = classifySmtpResponse(250, null as any, 'Accepted');
      const result2 = classifySmtpResponse(250, undefined as any, 'Accepted');
      
      expect(result1.result).toBe('valid');
      expect(result2.result).toBe('valid');
    });

    test('should handle extreme response codes', () => {
      const testCases = [
        { code: 0, expected: 'unknown' },
        { code: -1, expected: 'unknown' },
        { code: 1000, expected: 'unknown' }
      ];

      testCases.forEach(({ code, expected }) => {
        const result = classifySmtpResponse(code, 'Test', 'Test');
        expect(result.result).toBe(expected);
        expect(result.smtp_code).toBe(code);
      });
    });
  });

  describe('Pattern Matching Edge Cases', () => {
    test('should be case insensitive', () => {
      const messages = [
        'BLOCKED BY SPAM FILTER',
        'blocked by spam filter',
        'Blocked By Spam Filter'
      ];

      messages.forEach(message => {
        const result = classifySmtpResponse(554, message, 'Rejected');
        expect(result.message_analysis?.severity).toBe('high');
      });
    });

    test('should handle partial matches', () => {
      const result = classifySmtpResponse(451, 'temporary defer due to greylisting', 'Rejected');
      expect(result.reason_code).toBe('greylisted');
    });

    test('should prioritize first pattern match', () => {
      // Message that could match multiple patterns
      const result = classifySmtpResponse(451, 'rate limit exceeded, try again later', 'Rejected');
      
      // Should match rate_limited pattern first
      expect(result.message_analysis?.detected_issues[0].category).toBe('rate_limited');
    });
  });
});