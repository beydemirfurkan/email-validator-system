"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailValidationService = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const dns_1 = require("dns");
const punycode = __importStar(require("punycode.js"));
const disposable_email_domains_1 = __importDefault(require("disposable-email-domains"));
const mx_cache_service_1 = require("./mx-cache.service");
const upstash_cache_service_1 = require("./upstash-cache.service");
class EmailValidationService {
    batchSize;
    invalidPatterns;
    disposableDomains;
    mxCache;
    statistics;
    constructor(config = { batchSize: 10 }) {
        this.batchSize = config.batchSize;
        this.invalidPatterns = this.initializeInvalidPatterns();
        this.disposableDomains = new Set(disposable_email_domains_1.default);
        this.mxCache = new mx_cache_service_1.MxCache();
        this.statistics = {
            totalProcessed: 0,
            totalValid: 0,
            totalInvalid: 0,
            reasons: new Map()
        };
    }
    initializeInvalidPatterns() {
        const dataDir = path_1.default.join(__dirname, '..', '..', 'data');
        try {
            const placeholderDomains = this.loadTextFile(path_1.default.join(dataDir, 'placeholder-domains.txt'));
            const spamKeywords = this.loadTextFile(path_1.default.join(dataDir, 'spam-keywords.txt'));
            const typoDomains = this.loadTypoDomains(path_1.default.join(dataDir, 'typo-domains.txt'));
            return {
                placeholderDomains,
                spamKeywords,
                typoDomains
            };
        }
        catch (error) {
            console.error('Error loading invalid patterns from files:', error);
            console.error('Using fallback patterns as a safety measure');
            return {
                placeholderDomains: [],
                spamKeywords: [],
                typoDomains: new Map()
            };
        }
    }
    loadTextFile(filePath) {
        if (!fs_1.default.existsSync(filePath)) {
            console.warn(`Pattern file not found: ${filePath}`);
            return [];
        }
        return fs_1.default.readFileSync(filePath, 'utf8')
            .split('\n')
            .map(line => line.trim())
            .filter(line => line && !line.startsWith('#'));
    }
    loadTypoDomains(filePath) {
        if (!fs_1.default.existsSync(filePath)) {
            console.warn(`Typo domains file not found: ${filePath}`);
            return new Map();
        }
        const typoMap = new Map();
        const lines = fs_1.default.readFileSync(filePath, 'utf8')
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
    normalizeInternationalEmail(email) {
        const atIndex = email.lastIndexOf('@');
        if (atIndex === -1)
            return email;
        const localPart = email.substring(0, atIndex);
        const domain = email.substring(atIndex + 1);
        try {
            const asciiDomain = punycode.toASCII(domain);
            if (!/^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+$/.test(localPart)) {
                throw new Error('Non-ASCII characters in local part not supported');
            }
            return `${localPart}@${asciiDomain}`;
        }
        catch (error) {
            console.warn(`International email normalization failed for: ${email}`, error);
            return null;
        }
    }
    isValidEmailFormat(email) {
        const emailRegex = /^[a-zA-Z0-9._+-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
        if (!emailRegex.test(email)) {
            return false;
        }
        if (this.hasRestrictedCharacters(email)) {
            return false;
        }
        const emailParts = email.split('@');
        if (emailParts.length !== 2)
            return false;
        const localPart = emailParts[0];
        const domain = emailParts[1];
        if (localPart.length > 64)
            return false;
        if (localPart.startsWith('.') || localPart.endsWith('.'))
            return false;
        if (localPart.includes('..'))
            return false;
        if (domain.length > 253)
            return false;
        if (domain.startsWith('-') || domain.endsWith('-'))
            return false;
        if (domain.includes('..'))
            return false;
        if (this.hasDynamicSuspiciousPatterns(localPart, domain)) {
            return false;
        }
        if (!this.isValidPlusAddressing(localPart, domain)) {
            return false;
        }
        return true;
    }
    hasRestrictedCharacters(email) {
        if (email.includes('"'))
            return true;
        if (email.includes(' '))
            return true;
        if (email.includes('\\\\'))
            return true;
        const restrictedChars = ['!', '#', '$', '%', '&', "'", '*', '/', '=', '?', '^', '`', '{', '|', '}', '~'];
        for (const char of restrictedChars) {
            if (email.includes(char))
                return true;
        }
        if (email.includes('(') || email.includes(')'))
            return true;
        if (email.includes('<') || email.includes('>'))
            return true;
        if (email.includes('[') || email.includes(']'))
            return true;
        return false;
    }
    hasDynamicSuspiciousPatterns(localPart, domain) {
        if (this.hasExcessiveRepeatingChars(localPart))
            return true;
        if (localPart.length === 1)
            return true;
        if (this.isAllSameCharacter(localPart))
            return true;
        if (this.hasSequentialPattern(localPart))
            return true;
        if (this.looksRandomGenerated(localPart))
            return true;
        return false;
    }
    hasExcessiveRepeatingChars(text) {
        return /(.)\1{4,}/.test(text);
    }
    isAllSameCharacter(text) {
        if (text.length < 3)
            return false;
        return /^(.)\1+$/.test(text);
    }
    hasSequentialPattern(text) {
        if (text.length < 4)
            return false;
        const codes = text.toLowerCase().split('').map(c => c.charCodeAt(0));
        let sequentialCount = 1;
        for (let i = 1; i < codes.length; i++) {
            if (codes[i] === codes[i - 1] + 1) {
                sequentialCount++;
                if (sequentialCount >= 4) {
                    return true;
                }
            }
            else {
                sequentialCount = 1;
            }
        }
        return false;
    }
    looksRandomGenerated(text) {
        if (text.length < 8)
            return false;
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
    isValidPlusAddressing(localPart, domain) {
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
        const basePart = plusParts[0];
        const tagPart = plusParts[1];
        if (!basePart || !tagPart || basePart.length === 0 || tagPart.length === 0) {
            return false;
        }
        if (/^(test|spam|fake|dummy|temp)$/i.test(tagPart)) {
            return false;
        }
        return true;
    }
    isDisposableEmail(domain) {
        return this.disposableDomains.has(domain.toLowerCase());
    }
    checkTypoDomain(domain) {
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
    isPlaceholderEmail(email) {
        const emailLower = email.toLowerCase();
        const [localPart, domain] = emailLower.split('@');
        if (!localPart || !domain)
            return false;
        const isDomainPlaceholder = this.invalidPatterns.placeholderDomains.includes(domain);
        if (isDomainPlaceholder)
            return true;
        return this.hasSignificantSpamPatterns(localPart, domain);
    }
    hasSignificantSpamPatterns(localPart, domain) {
        if (this.isSpamDominant(localPart)) {
            return true;
        }
        const domainWithoutTld = domain.replace(/\.[^.]+$/, '');
        if (this.isSpamDominant(domainWithoutTld)) {
            return true;
        }
        return false;
    }
    isSpamDominant(text) {
        const words = text.split(/[._-]+/).filter(word => word.length > 0);
        if (words.length === 0)
            return false;
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
    async checkMXRecord(domain) {
        const cachedResult = this.mxCache.get(domain);
        if (cachedResult !== null) {
            return cachedResult.hasRecords;
        }
        let hasRecords = false;
        let lookupError = null;
        try {
            const mxRecords = await dns_1.promises.resolveMx(domain);
            hasRecords = mxRecords && mxRecords.length > 0;
        }
        catch (error) {
            lookupError = error.message;
            try {
                await dns_1.promises.resolve4(domain);
                hasRecords = true;
            }
            catch (aError) {
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
    async validateSingle(email) {
        const startTime = performance.now();
        try {
            if (!this.isValidEmailFormat(email)) {
                throw new Error('Invalid email format');
            }
            const cached = await upstash_cache_service_1.upstashCache.getEmailValidation(email);
            if (cached) {
                return {
                    ...cached,
                    fromCache: true,
                    processingTime: performance.now() - startTime
                };
            }
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
            const localPart = emailParts[0];
            const domain = emailParts[1];
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
            const result = {
                valid: hasMXRecord,
                email: cleanEmail,
                score: hasMXRecord ? 100 : 30,
                reason: hasMXRecord ? [] : ['No MX record found'],
                details: {
                    format: true,
                    mx: hasMXRecord,
                    disposable: true,
                    role: true,
                    typo: true,
                    suspicious: true,
                    spamKeywords: true
                },
                fromCache: false,
                processingTime: performance.now() - startTime
            };
            if (result.valid !== undefined) {
                await upstash_cache_service_1.upstashCache.setEmailValidation(email, result, { ttl: 24 * 60 * 60 });
            }
            return result;
        }
        catch (error) {
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
        }
        finally {
            this.updateStatistics(email);
        }
    }
    updateStatistics(email) {
        this.statistics.totalProcessed++;
    }
    async validateBatch(emails, requestId) {
        const results = [];
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
    async processBatch(batch) {
        const promises = batch.map(email => this.validateSingle(email));
        return await Promise.all(promises);
    }
    logProgress(processed, total, logPrefix) {
        const percentage = Math.min(Math.round((processed / total) * 100), 100);
        console.log(`${logPrefix} Progress: ${processed}/${total} emails processed (${percentage}%)`);
    }
    removeDuplicates(emails) {
        return [...new Set(emails.map(email => email.toLowerCase()))];
    }
    calculateStatistics(results) {
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
    getCacheStatistics() {
        return this.mxCache.getStatistics();
    }
    clearMxCache() {
        this.mxCache.flush();
    }
    getCachedDomains() {
        return this.mxCache.getCachedDomains();
    }
}
exports.EmailValidationService = EmailValidationService;
//# sourceMappingURL=email-validation.service.js.map