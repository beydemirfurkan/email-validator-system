import fs from 'fs';
import path from 'path';
import { promises as dns } from 'dns';
// @ts-ignore - punycode.js doesn't have types
import * as punycode from 'punycode.js';
import disposableDomains from 'disposable-email-domains';
import { MxCache, CacheStatistics } from './mx-cache.service';
import { upstashCache } from './upstash-cache.service';
import { ValidationResult } from '../types/api';
import { SMTPVerificationService } from './smtp/smtp-verification.service';
import { initializeConnectionPool } from './smtp/connection-pool.service';
import { appConfig } from '../config/app-config';

interface ValidationConfig {
  batchSize: number;
  enableSmtpValidation?: boolean;
}

interface InvalidPatterns {
  placeholderDomains: string[];
  spamKeywords: string[];
  typoDomains: Map<string, string>;
}

interface Statistics {
  totalProcessed: number;
  totalValid: number;
  totalInvalid: number;
  reasons: Map<string, number>;
}

interface TypoCheckResult {
  isTypo: boolean;
  suggestedDomain: string | null;
  originalDomain: string;
}

export class EmailValidationService {
  private readonly batchSize: number;
  private readonly enableSmtpValidation: boolean;
  private readonly invalidPatterns: InvalidPatterns;
  private readonly disposableDomains: Set<string>;
  private readonly mxCache: MxCache;
  private readonly statistics: Statistics;
  private readonly smtpVerificationService: SMTPVerificationService;

  constructor(config: ValidationConfig = { 
    batchSize: appConfig.validation.batchSize, 
    enableSmtpValidation: appConfig.validation.enableSmtpValidation 
  }) {
    this.batchSize = config.batchSize;
    this.enableSmtpValidation = config.enableSmtpValidation || false;
    this.invalidPatterns = this.initializeInvalidPatterns();
    this.disposableDomains = new Set(disposableDomains);
    this.mxCache = new MxCache();
    
    this.statistics = {
      totalProcessed: 0,
      totalValid: 0,
      totalInvalid: 0,
      reasons: new Map()
    };

    // Initialize SMTP verification service
    this.smtpVerificationService = new SMTPVerificationService();
    
    // Initialize connection pool if SMTP validation is enabled
    if (this.enableSmtpValidation) {
      initializeConnectionPool({
        maxConnectionsPerPool: appConfig.smtp.maxConnectionsPerPool,
        connectionTimeout: appConfig.smtp.connectTimeout,
        maxIdleTime: appConfig.smtp.maxIdleTime,
        enablePooling: appConfig.smtp.enableConnectionPooling
      });
    }
  }

  private initializeInvalidPatterns(): InvalidPatterns {
    const dataDir = path.join(__dirname, '..', '..', 'data');
    
    try {
      const placeholderDomains = this.loadTextFile(path.join(dataDir, 'placeholder-domains.txt'));
      const spamKeywords = this.loadTextFile(path.join(dataDir, 'spam-keywords.txt'));
      const typoDomains = this.loadTypoDomains(path.join(dataDir, 'typo-domains.txt'));

      return {
        placeholderDomains,
        spamKeywords,
        typoDomains
      };
    } catch (error) {
      console.error('Error loading invalid patterns from files:', error);
      console.error('Using fallback patterns as a safety measure');
      return {
        placeholderDomains: [],
        spamKeywords: [],
        typoDomains: new Map()
      };
    }
  }

  private loadTextFile(filePath: string): string[] {
    if (!fs.existsSync(filePath)) {
      console.warn(`Pattern file not found: ${filePath}`);
      return [];
    }

    return fs.readFileSync(filePath, 'utf8')
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#'));
  }

  private loadTypoDomains(filePath: string): Map<string, string> {
    if (!fs.existsSync(filePath)) {
      console.warn(`Typo domains file not found: ${filePath}`);
      return new Map();
    }

    const typoMap = new Map<string, string>();
    const lines = fs.readFileSync(filePath, 'utf8')
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#'));

    for (const line of lines) {
      const [typoDomain, correctDomain] = line.split(':');
      if (typoDomain && correctDomain) {
        typoMap.set(typoDomain.trim(), correctDomain.trim());
      }
    }

    return typoMap;
  }

  private normalizeInternationalEmail(email: string): string | null {
    const atIndex = email.lastIndexOf('@');
    if (atIndex === -1) return email;

    const localPart = email.substring(0, atIndex);
    const domain = email.substring(atIndex + 1);

    try {
      const asciiDomain = punycode.toASCII(domain);
      
      if (!/^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+$/.test(localPart)) {
        throw new Error('Non-ASCII characters in local part not supported');
      }
      
      return `${localPart}@${asciiDomain}`;
    } catch (error) {
      console.warn(`International email normalization failed for: ${email}`, error);
      return null;
    }
  }

  private isValidEmailFormat(email: string): boolean {
    const emailRegex = /^[a-zA-Z0-9._+-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    
    if (!emailRegex.test(email)) {
      return false;
    }

    if (this.hasRestrictedCharacters(email)) {
      return false;
    }

    const emailParts = email.split('@');
    if (emailParts.length !== 2) return false;
    
    const localPart = emailParts[0]!;
    const domain = emailParts[1]!;
    
    // Local part validation
    if (localPart.length > 64) return false;
    if (localPart.startsWith('.') || localPart.endsWith('.')) return false;
    if (localPart.includes('..')) return false;
    
    // Domain validation  
    if (domain.length > 253) return false;
    if (domain.startsWith('-') || domain.endsWith('-')) return false;
    if (domain.includes('..')) return false;
    
    // Dynamic suspicious pattern detection
    if (this.hasDynamicSuspiciousPatterns(localPart, domain)) {
      return false;
    }
    
    // Plus addressing validation
    if (!this.isValidPlusAddressing(localPart, domain)) {
      return false;
    }
    
    return true;
  }

  private hasRestrictedCharacters(email: string): boolean {
    if (email.includes('"')) return true;
    if (email.includes(' ')) return true;
    if (email.includes('\\\\')) return true;

    const restrictedChars = ['!', '#', '$', '%', '&', "'", '*', '/', '=', '?', '^', '`', '{', '|', '}', '~'];
    for (const char of restrictedChars) {
      if (email.includes(char)) return true;
    }

    if (email.includes('(') || email.includes(')')) return true;
    if (email.includes('<') || email.includes('>')) return true;
    if (email.includes('[') || email.includes(']')) return true;

    return false;
  }

  private hasDynamicSuspiciousPatterns(localPart: string, domain: string): boolean {
    if (this.hasExcessiveRepeatingChars(localPart)) return true;
    if (localPart.length === 1) return true;
    if (this.isAllSameCharacter(localPart)) return true;
    if (this.hasSequentialPattern(localPart)) return true;
    if (this.looksRandomGenerated(localPart)) return true;
    
    return false;
  }

  private hasExcessiveRepeatingChars(text: string): boolean {
    return /(.)\1{4,}/.test(text);
  }

  private isAllSameCharacter(text: string): boolean {
    if (text.length < 3) return false;
    return /^(.)\1+$/.test(text);
  }

  private hasSequentialPattern(text: string): boolean {
    if (text.length < 4) return false;
    
    const codes = text.toLowerCase().split('').map(c => c.charCodeAt(0));
    let sequentialCount = 1;
    
    for (let i = 1; i < codes.length; i++) {
      if (codes[i] === codes[i-1]! + 1) {
        sequentialCount++;
        if (sequentialCount >= 4) {
          return true;
        }
      } else {
        sequentialCount = 1;
      }
    }
    
    return false;
  }

  private looksRandomGenerated(text: string): boolean {
    if (text.length < 8) return false;
    
    const chars = text.toLowerCase();
    const uniqueChars = new Set(chars).size;
    const totalChars = chars.length;
    
    const variety = uniqueChars / totalChars;
    if (variety < 0.3 && totalChars > 8) {
      return true;
    }
    
    const keyboardPatterns = [
      'qwerty', 'asdfgh', 'zxcvbn', 'qwertyui', 'asdfghjk', 'zxcvbnm',
      '123456', '098765', '1234567890', '0987654321'
    ];
    
    for (const pattern of keyboardPatterns) {
      if (chars.includes(pattern) || chars.includes(pattern.split('').reverse().join(''))) {
        return true;
      }
    }
    
    return false;
  }

  private isValidPlusAddressing(localPart: string, domain: string): boolean {
    if (!localPart.includes('+')) {
      return true;
    }

    const domainLower = domain.toLowerCase();

    const noSupportProviders = [
      'aol.com', 'aol.co.uk',
      'yandex.com', 'yandex.ru',
      'mail.ru',
      'protonmail.com', 'proton.me',
      'zoho.com',
      'tutanota.com',
      'fastmail.com'
    ];

    if (noSupportProviders.includes(domainLower)) {
      return false;
    }

    const plusParts = localPart.split('+');
    if (plusParts.length !== 2) {
      return false;
    }

    const basePart = plusParts[0]!;
    const tagPart = plusParts[1]!;
    
    if (!basePart || !tagPart || basePart.length === 0 || tagPart.length === 0) {
      return false;
    }

    if (/^(test|spam|fake|dummy|temp)$/i.test(tagPart)) {
      return false;
    }

    return true;
  }

  private isDisposableEmail(domain: string): boolean {
    return this.disposableDomains.has(domain.toLowerCase());
  }

  private checkTypoDomain(domain: string): TypoCheckResult {
    const domainLower = domain.toLowerCase();
    
    if (this.invalidPatterns.typoDomains.has(domainLower)) {
      return {
        isTypo: true,
        suggestedDomain: this.invalidPatterns.typoDomains.get(domainLower) || null,
        originalDomain: domainLower
      };
    }

    return {
      isTypo: false,
      suggestedDomain: null,
      originalDomain: domainLower
    };
  }

  private isPlaceholderEmail(email: string): boolean {
    const emailLower = email.toLowerCase();
    const [localPart, domain] = emailLower.split('@');

    if (!localPart || !domain) return false;

    const isDomainPlaceholder = this.invalidPatterns.placeholderDomains.includes(domain);
    if (isDomainPlaceholder) return true;

    return this.hasSignificantSpamPatterns(localPart, domain);
  }

  private hasSignificantSpamPatterns(localPart: string, domain: string): boolean {
    if (this.isSpamDominant(localPart)) {
      return true;
    }
    
    const domainWithoutTld = domain.replace(/\.[^.]+$/, '');
    if (this.isSpamDominant(domainWithoutTld)) {
      return true;
    }
    
    return false;
  }

  private isSpamDominant(text: string): boolean {
    const words = text.split(/[._-]+/).filter(word => word.length > 0);
    
    if (words.length === 0) return false;
    
    let spamCount = 0;
    for (const word of words) {
      if (this.invalidPatterns.spamKeywords.includes(word.toLowerCase())) {
        spamCount++;
      }
    }
    
    if (words.length === 1 && spamCount === 1) {
      return true;
    }
    
    if (words.length > 1 && spamCount === words.length) {
      return true;
    }
    
    return false;
  }

  private async checkMXRecord(domain: string): Promise<boolean> {
    const cachedResult = this.mxCache.get(domain);
    if (cachedResult !== null) {
      return cachedResult.hasRecords;
    }

    let hasRecords = false;
    let lookupError: string | null = null;

    try {
      const mxRecords = await dns.resolveMx(domain);
      hasRecords = mxRecords && mxRecords.length > 0;
    } catch (error: any) {
      lookupError = error.message;
      try {
        await dns.resolve4(domain);
        hasRecords = true;
      } catch (aError: any) {
        hasRecords = false;
        lookupError = `MX: ${error.message}, A: ${aError.message}`;
      }
    }

    const result = {
      hasRecords,
      error: lookupError,
      timestamp: Date.now()
    };

    const ttl = hasRecords ? 300000 : 60000;
    this.mxCache.set(domain, result, ttl);

    return hasRecords;
  }

  async validateSingle(email: string): Promise<ValidationResult> {
    const startTime = performance.now();
    
    try {
      // 1. Security: Email format check first
      if (!this.isValidEmailFormat(email)) {
        throw new Error('Invalid email format')
      }

      // 2. Check cache first
      const cached = await upstashCache.getEmailValidation(email)
      if (cached) {
        return {
          ...cached,
          fromCache: true,
          processingTime: performance.now() - startTime
        }
      }

      // 3. Perform validation (existing logic)
      let cleanEmail = email.trim().toLowerCase();
      
      if (cleanEmail.length >= 250) {
        return {
          valid: false,
          email: email,
          score: 0,
          reason: ['Email address too long (250+ characters)'],
          details: {
            format: false,
            mx: false,
            disposable: false,
            role: false,
            typo: false,
            suspicious: false,
            spamKeywords: false
          }
        };
      }
      
      const normalizedEmail = this.normalizeInternationalEmail(cleanEmail);
      
      if (normalizedEmail === null) {
        return {
          valid: false,
          email: email,
          score: 0,
          reason: ['International characters not supported in local part'],
          details: {
            format: false,
            mx: false,
            disposable: false,
            role: false,
            typo: false,
            suspicious: false,
            spamKeywords: false
          }
        };
      }

      cleanEmail = normalizedEmail;

      if (!this.isValidEmailFormat(cleanEmail)) {
        return {
          valid: false,
          email: cleanEmail,
          score: 0,
          reason: ['Invalid email format'],
          details: {
            format: false,
            mx: false,
            disposable: true,
            role: true,
            typo: true,
            suspicious: false,
            spamKeywords: true
          }
        };
      }

      const emailParts = cleanEmail.split('@');
      if (emailParts.length !== 2) {
        return {
          valid: false,
          email: cleanEmail,
          score: 0,
          reason: ['Invalid email format - missing @ symbol'],
          details: {
            format: false,
            mx: false,
            disposable: false,
            role: false,
            typo: false,
            suspicious: false,
            spamKeywords: false
          }
        };
      }

      const localPart = emailParts[0]!;
      const domain = emailParts[1]!;

      const typoCheck = this.checkTypoDomain(domain);
      if (typoCheck.isTypo) {
        return {
          valid: false,
          email: cleanEmail,
          score: 20,
          reason: [`Domain appears to be a typo. Did you mean '${typoCheck.suggestedDomain}'?`],
          details: {
            format: true,
            mx: false,
            disposable: true,
            role: true,
            typo: false,
            suspicious: true,
            spamKeywords: true
          },
          ...(typoCheck.suggestedDomain ? { suggestion: typoCheck.suggestedDomain } : {})
        };
      }

      const isDisposable = this.isDisposableEmail(domain);
      if (isDisposable) {
        return {
          valid: false,
          email: cleanEmail,
          score: 10,
          reason: ['Disposable email address'],
          details: {
            format: true,
            mx: false,
            disposable: false,
            role: true,
            typo: true,
            suspicious: true,
            spamKeywords: true
          }
        };
      }

      if (this.isPlaceholderEmail(cleanEmail)) {
        return {
          valid: false,
          email: cleanEmail,
          score: 5,
          reason: ['Placeholder or example email detected'],
          details: {
            format: true,
            mx: false,
            disposable: true,
            role: true,
            typo: true,
            suspicious: false,
            spamKeywords: false
          }
        };
      }

      const hasMXRecord = await this.checkMXRecord(domain);
      
      if (!hasMXRecord) {
        return {
          valid: false,
          email: cleanEmail,
          score: 30,
          reason: ['No MX record found'],
          details: {
            format: true,
            mx: false,
            disposable: true,
            role: true,
            typo: true,
            suspicious: true,
            spamKeywords: true,
            smtp: false
          },
          fromCache: false,
          processingTime: performance.now() - startTime
        };
      }

      // SMTP validation if enabled
      let smtpValid = true;
      let smtpReason: string[] = [];
      let smtpScore = 100;
      let smtpDetails: any = null;

      if (this.enableSmtpValidation) {
        try {
          const smtpResult = await this.smtpVerificationService.verifyEmail(cleanEmail, {
            verbose: appConfig.smtp.verbose
          });

          smtpValid = smtpResult.valid;
          if (!smtpValid) {
            smtpReason.push(smtpResult.reason);
            smtpScore = 60; // Lower score for SMTP failure
          }
          smtpDetails = smtpResult.smtpDetails;
        } catch (error: any) {
          // SMTP verification failed, but don't fail the entire validation
          console.warn(`SMTP verification failed for ${cleanEmail}:`, error.message);
          smtpReason.push('SMTP verification unavailable');
          smtpScore = 80; // Reduced score but still considered valid
        }
      }

      const result = {
        valid: smtpValid,
        email: cleanEmail,
        score: smtpScore,
        reason: smtpReason,
        details: {
          format: true,
          mx: hasMXRecord,
          disposable: true,
          role: true,
          typo: true,
          suspicious: true,
          spamKeywords: true,
          smtp: this.enableSmtpValidation ? smtpValid : true
        },
        fromCache: false,
        processingTime: performance.now() - startTime,
        ...(smtpDetails && { smtpDetails })
      };

      // 4. Cache successful validations (24 hours)
      if (result.valid !== undefined) {
        await upstashCache.setEmailValidation(email, result, { ttl: 24 * 60 * 60 });
      }

      return result;

    } catch (error: any) {
      // Security: Don't expose internal errors
      console.error('Email validation error:', error);
      
      return {
        valid: false,
        email: email,
        score: 0,
        reason: ['Validation failed'],
        details: {
          format: false,
          mx: false,
          disposable: false,
          role: false,
          typo: false,
          suspicious: false,
          spamKeywords: false
        },
        fromCache: false,
        processingTime: performance.now() - startTime,
        error: process.env.NODE_ENV === 'development' ? error : undefined
      };
    } finally {
      this.updateStatistics(email);
    }
  }

  private updateStatistics(email: string): void {
    this.statistics.totalProcessed++;
  }

  async validateBatch(emails: string[], requestId?: string): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];
    const totalEmails = emails.length;
    const logPrefix = requestId ? `[${requestId}]` : '';

    console.log(`${logPrefix} Starting validation of ${totalEmails} emails in batches of ${this.batchSize}`);

    for (let i = 0; i < emails.length; i += this.batchSize) {
      const batch = emails.slice(i, i + this.batchSize);
      const batchNumber = Math.floor(i / this.batchSize) + 1;
      const totalBatches = Math.ceil(emails.length / this.batchSize);

      console.log(`${logPrefix} Processing batch ${batchNumber}/${totalBatches} (${batch.length} emails)`);

      const batchResults = await this.processBatch(batch);
      results.push(...batchResults);

      this.logProgress(i + this.batchSize, totalEmails, logPrefix);
    }

    console.log(`${logPrefix} Validation completed for all ${totalEmails} emails`);
    return results;
  }

  private async processBatch(batch: string[]): Promise<ValidationResult[]> {
    const promises = batch.map(email => this.validateSingle(email));
    return await Promise.all(promises);
  }

  private logProgress(processed: number, total: number, logPrefix: string): void {
    const percentage = Math.min(Math.round((processed / total) * 100), 100);
    console.log(`${logPrefix} Progress: ${processed}/${total} emails processed (${percentage}%)`);
  }

  removeDuplicates(emails: string[]): string[] {
    return [...new Set(emails.map(email => email.toLowerCase()))];
  }

  calculateStatistics(results: ValidationResult[]): {
    total: number;
    valid: number;
    invalid: number;
    validPercentage: number;
    invalidPercentage: number;
  } {
    const total = results.length;
    const valid = results.filter(r => r.valid).length;
    const invalid = results.filter(r => !r.valid).length;

    return {
      total,
      valid,
      invalid,
      validPercentage: total > 0 ? Math.round((valid / total) * 100) : 0,
      invalidPercentage: total > 0 ? Math.round((invalid / total) * 100) : 0
    };
  }

  getCacheStatistics(): CacheStatistics {
    return this.mxCache.getStatistics();
  }

  clearMxCache(): void {
    this.mxCache.flush();
  }

  getCachedDomains(): string[] {
    return this.mxCache.getCachedDomains();
  }
}