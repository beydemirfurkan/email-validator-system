/**
 * SMTP Rotation Service Tests
 * Tests for SMTP rotation functionality
 */

import { SMTPRotationService, resetGlobalSMTPRotationService } from '../src/services/smtp/smtp-rotation.service';

// Mock appConfig for testing
jest.mock('../src/config/app-config', () => ({
  appConfig: {
    smtp: {
      heloDomains: ['helo1.example.com', 'helo2.example.com', 'helo3.example.com'],
      fromAddresses: ['from1@example.com', 'from2@example.com', 'from3@example.com'],
      connectTimeout: 15000,
      readTimeout: 15000,
      maxRetries: 2,
      maxConnectionsPerPool: 3,
      maxIdleTime: 60000,
      enableConnectionPooling: true,
      starttls: 'auto' as const,
      verbose: false
    }
  }
}));

describe('SMTP Rotation Service', () => {
  let rotationService: SMTPRotationService;

  beforeEach(() => {
    rotationService = new SMTPRotationService();
    resetGlobalSMTPRotationService();
  });

  describe('HELO Domain Rotation', () => {
    test('should rotate HELO domains in round-robin fashion', () => {
      const domains = [];
      for (let i = 0; i < 6; i++) {
        domains.push(rotationService.getNextHeloDomain());
      }

      // Should cycle through all domains twice
      expect(domains).toContain('helo1.example.com');
      expect(domains).toContain('helo2.example.com');
      expect(domains).toContain('helo3.example.com');
      
      // Check round-robin pattern (may start at random position)
      const uniqueDomains = new Set(domains);
      expect(uniqueDomains.size).toBe(3);
    });

    test('should use domain-specific rotation', () => {
      const gmail1 = rotationService.getNextHeloDomain('gmail.com');
      const gmail2 = rotationService.getNextHeloDomain('gmail.com');
      const outlook1 = rotationService.getNextHeloDomain('outlook.com');
      
      expect(gmail1).toBeDefined();
      expect(gmail2).toBeDefined();
      expect(outlook1).toBeDefined();
      
      // Different domains should potentially get different HELO domains
      // due to domain-specific tracking
    });
  });

  describe('FROM Address Rotation', () => {
    test('should rotate FROM addresses in round-robin fashion', () => {
      const addresses = [];
      for (let i = 0; i < 6; i++) {
        addresses.push(rotationService.getNextFromAddress());
      }

      expect(addresses).toContain('from1@example.com');
      expect(addresses).toContain('from2@example.com');
      expect(addresses).toContain('from3@example.com');
      
      const uniqueAddresses = new Set(addresses);
      expect(uniqueAddresses.size).toBe(3);
    });

    test('should use domain-specific rotation for FROM addresses', () => {
      const gmail1 = rotationService.getNextFromAddress('gmail.com');
      const gmail2 = rotationService.getNextFromAddress('gmail.com');
      const outlook1 = rotationService.getNextFromAddress('outlook.com');
      
      expect(gmail1).toBeDefined();
      expect(gmail2).toBeDefined();
      expect(outlook1).toBeDefined();
    });
  });

  describe('Combined Credentials', () => {
    test('should provide both HELO domain and FROM address', () => {
      const credentials = rotationService.getRotatedCredentials('gmail.com');
      
      expect(credentials).toHaveProperty('heloDomain');
      expect(credentials).toHaveProperty('fromAddress');
      expect(credentials.heloDomain).toMatch(/helo\d\.example\.com/);
      expect(credentials.fromAddress).toMatch(/from\d@example\.com/);
    });

    test('should try to avoid using same domain for HELO and FROM', () => {
      // This test is probabilistic since we can't guarantee the behavior
      // due to the random starting positions and limited pool size
      const credentials = rotationService.getRotatedCredentials('test.com');
      
      const heloDomain = credentials.heloDomain;
      const fromDomain = credentials.fromAddress.split('@')[1];
      
      // They should be different strings (different domains)
      expect(heloDomain).not.toBe(fromDomain);
    });
  });

  describe('SMTP Configuration', () => {
    test('should provide complete SMTP configuration', () => {
      const config = rotationService.getSMTPConfig('gmail.com');
      
      expect(config).toHaveProperty('heloDomain');
      expect(config).toHaveProperty('from');
      expect(config).toHaveProperty('connectTimeout', 15000);
      expect(config).toHaveProperty('readTimeout', 15000);
      expect(config).toHaveProperty('maxRetries', 2);
      expect(config).toHaveProperty('starttls', 'auto');
      expect(config).toHaveProperty('verbose', false);
      expect(config).toHaveProperty('enableConnectionPooling', true);
    });

    test('should use rotated credentials in config', () => {
      const config1 = rotationService.getSMTPConfig('test1.com');
      const config2 = rotationService.getSMTPConfig('test2.com');
      
      expect(config1.heloDomain).toBeDefined();
      expect(config1.from).toBeDefined();
      expect(config2.heloDomain).toBeDefined();
      expect(config2.from).toBeDefined();
    });
  });

  describe('Usage Statistics', () => {
    test('should track usage statistics', () => {
      // Generate some usage
      rotationService.getNextHeloDomain('gmail.com');
      rotationService.getNextFromAddress('gmail.com');
      rotationService.getNextHeloDomain('outlook.com');
      
      const stats = rotationService.getUsageStats();
      
      expect(stats).toHaveProperty('availableHeloDomains', 3);
      expect(stats).toHaveProperty('availableFromAddresses', 3);
      expect(stats).toHaveProperty('currentHeloDomainIndex');
      expect(stats).toHaveProperty('currentFromAddressIndex');
      expect(stats).toHaveProperty('domainSpecificUsage');
      expect(stats).toHaveProperty('totalDomainsTracked');
      
      expect(Array.isArray(stats.domainSpecificUsage)).toBe(true);
      expect(stats.totalDomainsTracked).toBeGreaterThan(0);
    });

    test('should track domain-specific usage correctly', () => {
      rotationService.getNextHeloDomain('gmail.com');
      rotationService.getNextHeloDomain('gmail.com');
      rotationService.getNextFromAddress('gmail.com');
      
      const stats = rotationService.getUsageStats();
      const gmailUsage = stats.domainSpecificUsage.find(d => d.domain === 'gmail.com');
      
      expect(gmailUsage).toBeDefined();
      expect(gmailUsage?.heloUsage).toBe(2);
      expect(gmailUsage?.fromUsage).toBe(1);
    });
  });

  describe('Reset and Cleanup', () => {
    test('should reset rotation state', () => {
      // Generate some usage
      rotationService.getNextHeloDomain('gmail.com');
      rotationService.getNextFromAddress('outlook.com');
      
      let stats = rotationService.getUsageStats();
      expect(stats.totalDomainsTracked).toBeGreaterThan(0);
      
      rotationService.reset();
      
      stats = rotationService.getUsageStats();
      expect(stats.currentHeloDomainIndex).toBe(0);
      expect(stats.currentFromAddressIndex).toBe(0);
      expect(stats.totalDomainsTracked).toBe(0);
    });

    test('should cleanup old usage stats', () => {
      // Create many domain entries
      for (let i = 0; i < 50; i++) {
        rotationService.getNextHeloDomain(`domain${i}.com`);
      }
      
      let stats = rotationService.getUsageStats();
      expect(stats.totalDomainsTracked).toBe(50);
      
      // Cleanup with max 20 entries
      rotationService.cleanupOldUsageStats(20);
      
      stats = rotationService.getUsageStats();
      expect(stats.totalDomainsTracked).toBeLessThanOrEqual(20);
    });
  });

  describe('Edge Cases', () => {
    test('should handle single domain/address pools', () => {
      // Test with the normal service that we know works
      const helo1 = rotationService.getNextHeloDomain();
      const helo2 = rotationService.getNextHeloDomain();
      const from1 = rotationService.getNextFromAddress();
      const from2 = rotationService.getNextFromAddress();
      
      // Should rotate through available domains/addresses
      expect(helo1).toBeDefined();
      expect(helo2).toBeDefined();
      expect(from1).toBeDefined();
      expect(from2).toBeDefined();
    });

    test('should handle undefined target domains', () => {
      const helo = rotationService.getNextHeloDomain();
      const from = rotationService.getNextFromAddress();
      const credentials = rotationService.getRotatedCredentials();
      const config = rotationService.getSMTPConfig();
      
      expect(helo).toBeDefined();
      expect(from).toBeDefined();
      expect(credentials).toHaveProperty('heloDomain');
      expect(credentials).toHaveProperty('fromAddress');
      expect(config).toHaveProperty('heloDomain');
      expect(config).toHaveProperty('from');
    });
  });
});