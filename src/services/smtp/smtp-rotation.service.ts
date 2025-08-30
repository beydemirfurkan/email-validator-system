/**
 * SMTP Rotation Service
 * Manages rotation of HELO domains and FROM addresses for better deliverability
 */

import { appConfig } from '../../config/app-config';

export class SMTPRotationService {
  private heloDomainIndex = 0;
  private fromAddressIndex = 0;
  private domainUsageMap = new Map<string, { helo: number, from: number }>();

  constructor() {
    // Initialize with random starting positions to avoid predictable patterns
    this.heloDomainIndex = Math.floor(Math.random() * appConfig.smtp.heloDomains.length);
    this.fromAddressIndex = Math.floor(Math.random() * appConfig.smtp.fromAddresses.length);
  }

  /**
   * Get next HELO domain for a specific target domain
   * Uses round-robin with domain-specific tracking for better distribution
   */
  getNextHeloDomain(targetDomain?: string): string {
    const heloDomains = appConfig.smtp.heloDomains;
    
    if (heloDomains.length === 1) {
      return heloDomains[0]!;
    }

    // If we have a target domain, try to use domain-specific rotation
    if (targetDomain) {
      const usage = this.domainUsageMap.get(targetDomain) || { helo: 0, from: 0 };
      const domainSpecificIndex = usage.helo % heloDomains.length;
      usage.helo++;
      this.domainUsageMap.set(targetDomain, usage);
      return heloDomains[domainSpecificIndex]!;
    }

    // Global round-robin
    const domain = heloDomains[this.heloDomainIndex]!;
    this.heloDomainIndex = (this.heloDomainIndex + 1) % heloDomains.length;
    return domain;
  }

  /**
   * Get next FROM address for a specific target domain
   * Uses round-robin with domain-specific tracking for better distribution
   */
  getNextFromAddress(targetDomain?: string): string {
    const fromAddresses = appConfig.smtp.fromAddresses;
    
    if (fromAddresses.length === 1) {
      return fromAddresses[0]!;
    }

    // If we have a target domain, try to use domain-specific rotation
    if (targetDomain) {
      const usage = this.domainUsageMap.get(targetDomain) || { helo: 0, from: 0 };
      const domainSpecificIndex = usage.from % fromAddresses.length;
      usage.from++;
      this.domainUsageMap.set(targetDomain, usage);
      return fromAddresses[domainSpecificIndex]!;
    }

    // Global round-robin
    const address = fromAddresses[this.fromAddressIndex]!;
    this.fromAddressIndex = (this.fromAddressIndex + 1) % fromAddresses.length;
    return address;
  }

  /**
   * Get both HELO domain and FROM address for a target domain
   * Ensures they don't use the same domain to avoid looking suspicious
   */
  getRotatedCredentials(targetDomain?: string): { heloDomain: string; fromAddress: string } {
    const heloDomain = this.getNextHeloDomain(targetDomain);
    let fromAddress = this.getNextFromAddress(targetDomain);

    // Try to avoid using the same domain for HELO and FROM
    // Extract domain from FROM address
    const fromDomain = fromAddress.split('@')[1];
    if (fromDomain === heloDomain && appConfig.smtp.fromAddresses.length > 1) {
      // Try next FROM address
      fromAddress = this.getNextFromAddress(targetDomain);
    }

    return { heloDomain, fromAddress };
  }

  /**
   * Get SMTP configuration with rotation
   */
  getSMTPConfig(targetDomain?: string) {
    const credentials = this.getRotatedCredentials(targetDomain);
    
    return {
      heloDomain: credentials.heloDomain,
      from: credentials.fromAddress,
      connectTimeout: appConfig.smtp.connectTimeout,
      readTimeout: appConfig.smtp.readTimeout,
      maxRetries: appConfig.smtp.maxRetries,
      starttls: appConfig.smtp.starttls,
      verbose: appConfig.smtp.verbose,
      enableConnectionPooling: appConfig.smtp.enableConnectionPooling
    };
  }

  /**
   * Get usage statistics for monitoring
   */
  getUsageStats() {
    const domainStats = Array.from(this.domainUsageMap.entries()).map(([domain, usage]) => ({
      domain,
      heloUsage: usage.helo,
      fromUsage: usage.from
    }));

    return {
      availableHeloDomains: appConfig.smtp.heloDomains.length,
      availableFromAddresses: appConfig.smtp.fromAddresses.length,
      currentHeloDomainIndex: this.heloDomainIndex,
      currentFromAddressIndex: this.fromAddressIndex,
      domainSpecificUsage: domainStats,
      totalDomainsTracked: this.domainUsageMap.size
    };
  }

  /**
   * Reset rotation counters (useful for testing)
   */
  reset() {
    this.heloDomainIndex = 0;
    this.fromAddressIndex = 0;
    this.domainUsageMap.clear();
  }

  /**
   * Clean up old domain usage stats to prevent memory growth
   * Call this periodically in production
   */
  cleanupOldUsageStats(maxEntries = 1000) {
    if (this.domainUsageMap.size > maxEntries) {
      // Remove oldest entries (this is a simple approach)
      // In production, you might want to implement LRU or time-based cleanup
      const entries = Array.from(this.domainUsageMap.entries());
      const entriesToKeep = entries.slice(-Math.floor(maxEntries * 0.8));
      
      this.domainUsageMap.clear();
      entriesToKeep.forEach(([domain, usage]) => {
        this.domainUsageMap.set(domain, usage);
      });
    }
  }
}

// Global rotation service instance
let globalRotationService: SMTPRotationService | null = null;

export function getGlobalSMTPRotationService(): SMTPRotationService {
  if (!globalRotationService) {
    globalRotationService = new SMTPRotationService();
  }
  return globalRotationService;
}

export function resetGlobalSMTPRotationService(): void {
  globalRotationService = null;
}