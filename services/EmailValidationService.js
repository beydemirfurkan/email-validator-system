const config = require('../config');
const fs = require('fs');
const path = require('path');
const dns = require('dns').promises;
const punycode = require('punycode.js');
const disposableDomains = require('disposable-email-domains');
const { globalMxCache } = require('./MxCache');

class EmailValidationService {
    constructor() {
        this.batchSize = config.validation.batchSize;
        this.invalidPatterns = this._initializeInvalidPatterns();
        this.disposableDomains = new Set(disposableDomains);
        this.mxCache = globalMxCache;
        
        // Thread-safe statistics
        this.statistics = {
            totalProcessed: 0,
            totalValid: 0,
            totalInvalid: 0,
            reasons: new Map() // reason -> count
        };
    }

    _initializeInvalidPatterns() {
        const dataDir = path.join(__dirname, '..', 'data');
        
        try {
            const placeholderDomains = this._loadTextFile(path.join(dataDir, 'placeholder-domains.txt'));
            const spamKeywords = this._loadTextFile(path.join(dataDir, 'spam-keywords.txt'));
            const typoDomains = this._loadTypoDomains(path.join(dataDir, 'typo-domains.txt'));

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

    _loadTextFile(filePath) {
        if (!fs.existsSync(filePath)) {
            console.warn(`Pattern file not found: ${filePath}`);
            return [];
        }

        return fs.readFileSync(filePath, 'utf8')
            .split('\n')
            .map(line => line.trim())
            .filter(line => line && !line.startsWith('#'));
    }

    _loadTypoDomains(filePath) {
        if (!fs.existsSync(filePath)) {
            console.warn(`Typo domains file not found: ${filePath}`);
            return new Map();
        }

        const typoMap = new Map();
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

    _normalizeInternationalEmail(email) {
        // Split email into local and domain parts
        const atIndex = email.lastIndexOf('@');
        if (atIndex === -1) return email;

        const localPart = email.substring(0, atIndex);
        const domain = email.substring(atIndex + 1);

        try {
            // Convert international domain to Punycode (ASCII)
            const asciiDomain = punycode.toASCII(domain);
            
            // For local part, we keep as-is for now but validate Unicode support
            // RFC 6530 allows UTF-8 in local part, but most systems don't support it yet
            // We'll be restrictive and only allow ASCII in local part
            if (!/^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+$/.test(localPart)) {
                throw new Error('Non-ASCII characters in local part not supported');
            }
            
            return `${localPart}@${asciiDomain}`;
        } catch (error) {
            // If conversion fails, mark as invalid
            console.warn(`International email normalization failed for: ${email}`, error.message);
            return null; // Signal that this email is invalid
        }
    }

    _isValidEmailFormat(email) {
        // Restrict to practical email format (no quoted strings, minimal special chars)
        // Only allow: letters, numbers, dots, hyphens, underscores, and + for plus addressing
        const emailRegex = /^[a-zA-Z0-9._+-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
        
        if (!emailRegex.test(email)) {
            return false;
        }

        // Additional checks for suspicious patterns
        if (this._hasRestrictedCharacters(email)) {
            return false;
        }

        const [localPart, domain] = email.split('@');
        
        // Local part validation
        if (localPart.length > 64) return false;
        if (localPart.startsWith('.') || localPart.endsWith('.')) return false;
        if (localPart.includes('..')) return false;
        
        // Domain validation  
        if (domain.length > 253) return false;
        if (domain.startsWith('-') || domain.endsWith('-')) return false;
        if (domain.includes('..')) return false;
        
        // Dynamic suspicious pattern detection
        if (this._hasDynamicSuspiciousPatterns(localPart, domain)) {
            return false;
        }
        
        // Plus addressing validation
        if (!this._isValidPlusAddressing(localPart, domain)) {
            return false;
        }
        
        return true;
    }

    _hasRestrictedCharacters(email) {
        // Check for quoted strings
        if (email.includes('"')) {
            return true;
        }

        // Check for spaces (should be trimmed already, but double-check)
        if (email.includes(' ')) {
            return true;
        }

        // Check for backslashes (used in quoted strings)
        if (email.includes('\\')) {
            return true;
        }

        // Check for restricted special characters (keeping practical ones)
        const restrictedChars = ['!', '#', '$', '%', '&', "'", '*', '/', '=', '?', '^', '`', '{', '|', '}', '~'];
        for (const char of restrictedChars) {
            if (email.includes(char)) {
                return true;
            }
        }

        // Check for parentheses (comments in email addresses)
        if (email.includes('(') || email.includes(')')) {
            return true;
        }

        // Check for angle brackets
        if (email.includes('<') || email.includes('>')) {
            return true;
        }

        // Check for square brackets (domain literals)
        if (email.includes('[') || email.includes(']')) {
            return true;
        }

        return false;
    }

    _hasDynamicSuspiciousPatterns(localPart, domain) {
        // 1. Repetitive character patterns (dynamic - any character)
        // sssssssssss@gmail.com, aaaaaaa@domain.com, 1111111@test.com
        if (this._hasExcessiveRepeatingChars(localPart)) {
            return true;
        }
        
        // 2. Very short suspicious local parts with single characters
        if (localPart.length === 1) {
            return true;
        }
        
        // 3. All same character patterns
        if (this._isAllSameCharacter(localPart)) {
            return true;
        }
        
        // 4. Sequential patterns (abc, 123, abcd, 1234567)
        if (this._hasSequentialPattern(localPart)) {
            return true;
        }
        
        // 5. Random-looking character combinations that are too random
        if (this._looksRandomGenerated(localPart)) {
            return true;
        }
        
        return false;
    }

    _hasExcessiveRepeatingChars(text) {
        // Check for any character repeated more than 4 times consecutively
        return /(.)\1{4,}/.test(text);
    }

    _isAllSameCharacter(text) {
        // Check if entire string is the same character repeated
        if (text.length < 3) return false; // Allow short combinations
        return /^(.)\1+$/.test(text);
    }

    _hasSequentialPattern(text) {
        // Check for sequential patterns like abc, 123, abcdef
        if (text.length < 4) return false; // Only flag longer sequences
        
        // Convert to char codes to check sequence
        const codes = text.toLowerCase().split('').map(c => c.charCodeAt(0));
        let sequentialCount = 1;
        
        for (let i = 1; i < codes.length; i++) {
            if (codes[i] === codes[i-1] + 1) {
                sequentialCount++;
                if (sequentialCount >= 4) { // 4+ sequential characters
                    return true;
                }
            } else {
                sequentialCount = 1;
            }
        }
        
        return false;
    }

    _looksRandomGenerated(text) {
        // Check for patterns that look like random generated strings
        if (text.length < 8) return false; // Only check longer strings
        
        // Calculate character variety and distribution
        const chars = text.toLowerCase();
        const uniqueChars = new Set(chars).size;
        const totalChars = chars.length;
        
        // If too few unique chars relative to length, might be suspicious
        const variety = uniqueChars / totalChars;
        if (variety < 0.3 && totalChars > 8) {
            return true;
        }
        
        // Check for long keyboard patterns (6+ chars)
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

    _isValidPlusAddressing(localPart, domain) {
        // Check if email uses plus addressing (user+tag format)
        if (!localPart.includes('+')) {
            return true; // No plus addressing, valid
        }

        const domainLower = domain.toLowerCase();

        // Providers that DON'T support plus addressing
        const noSupportProviders = [
            'aol.com', 'aol.co.uk',
            'yandex.com', 'yandex.ru',
            'mail.ru',
            'protonmail.com', 'proton.me',
            'zoho.com',
            'tutanota.com',
            'fastmail.com'
        ];

        // If domain doesn't support plus addressing, invalid
        if (noSupportProviders.includes(domainLower)) {
            return false;
        }

        // For supported providers and unknown domains, validate plus format
        const plusParts = localPart.split('+');
        if (plusParts.length !== 2) {
            return false; // Multiple + signs not allowed
        }

        const [basePart, tagPart] = plusParts;
        
        // Base part must be non-empty and valid
        if (basePart.length === 0 || tagPart.length === 0) {
            return false;
        }

        // Tag part should not contain certain suspicious patterns
        if (/^(test|spam|fake|dummy|temp)$/i.test(tagPart)) {
            return false;
        }

        return true;
    }

    _isDisposableEmail(domain) {
        return this.disposableDomains.has(domain.toLowerCase());
    }

    _checkTypoDomain(domain) {
        const domainLower = domain.toLowerCase();
        
        // Direct typo match
        if (this.invalidPatterns.typoDomains.has(domainLower)) {
            return {
                isTypo: true,
                suggestedDomain: this.invalidPatterns.typoDomains.get(domainLower),
                originalDomain: domainLower
            };
        }

        return {
            isTypo: false,
            suggestedDomain: null,
            originalDomain: domainLower
        };
    }

    _isPlaceholderEmail(email) {
        const emailLower = email.toLowerCase();
        const [localPart, domain] = emailLower.split('@');

        if (!localPart || !domain) return false;

        // Direct domain match (example.com, test.com etc.)
        const isDomainPlaceholder = this.invalidPatterns.placeholderDomains.includes(domain);
        if (isDomainPlaceholder) return true;

        // Smart keyword detection
        return this._hasSignificantSpamPatterns(localPart, domain);
    }

    _hasSignificantSpamPatterns(localPart, domain) {
        // 1. Check local part
        if (this._isSpamDominant(localPart)) {
            return true;
        }
        
        // 2. Check domain (without TLD)
        const domainWithoutTld = domain.replace(/\.[^.]+$/, ''); // remove .com, .ch etc
        if (this._isSpamDominant(domainWithoutTld)) {
            return true;
        }
        
        return false;
    }

    _isSpamDominant(text) {
        // Split into words by separators
        const words = text.split(/[._-]+/).filter(word => word.length > 0);
        
        if (words.length === 0) return false;
        
        // Count spam keywords
        let spamCount = 0;
        for (const word of words) {
            if (this.invalidPatterns.spamKeywords.includes(word.toLowerCase())) {
                spamCount++;
            }
        }
        
        // If single word and it's spam = SPAM
        if (words.length === 1 && spamCount === 1) {
            return true;
        }
        
        // If multiple words but ALL are spam = SPAM  
        if (words.length > 1 && spamCount === words.length) {
            return true;
        }
        
        // If has non-spam words mixed with spam = NOT SPAM
        return false;
    }



    async _checkMXRecord(domain) {
        // Check cache first
        const cachedResult = this.mxCache.get(domain);
        if (cachedResult !== null) {
            return cachedResult.hasRecords;
        }

        let hasRecords = false;
        let lookupError = null;

        try {
            const mxRecords = await dns.resolveMx(domain);
            hasRecords = mxRecords && mxRecords.length > 0;
        } catch (error) {
            lookupError = error.message;
            // If MX lookup fails, try A record as fallback
            try {
                await dns.resolve4(domain);
                hasRecords = true; // A record exists, can receive mail
            } catch (aError) {
                hasRecords = false;
                lookupError = `MX: ${error.message}, A: ${aError.message}`;
            }
        }

        // Cache the result (cache both success and failure for 5 minutes)
        const result = {
            hasRecords,
            error: lookupError,
            timestamp: Date.now()
        };

        // Cache successful lookups for longer (5 minutes), failures for shorter (1 minute)
        const ttl = hasRecords ? 300000 : 60000;
        this.mxCache.set(domain, result, ttl);

        return hasRecords;
    }

    async validateSingle(email) {
        try {
            let cleanEmail = email.trim().toLowerCase();
            
            // Check email length limit (250+ characters)
            if (cleanEmail.length >= 250) {
                return {
                    success: true,
                    email: email,
                    valid: false,
                    reason: 'Email address too long (250+ characters)',
                    details: {
                        format: { valid: false },
                        disposable: { valid: true },
                        mx: { valid: false },
                        placeholder: { valid: false },
                        typo: { valid: true }
                    },
                    timestamp: new Date().toISOString()
                };
            }
            
            // Handle international domains (Punycode conversion)
            cleanEmail = this._normalizeInternationalEmail(cleanEmail);
            
            // If normalization failed, email is invalid
            if (cleanEmail === null) {
                return {
                    success: true,
                    email: email,
                    valid: false,
                    reason: 'International characters not supported in local part',
                    details: {
                        format: { valid: false },
                        disposable: { valid: true },
                        mx: { valid: false },
                        placeholder: { valid: false },
                        typo: { valid: true }
                    },
                    timestamp: new Date().toISOString()
                };
            }

            // 1. Format validation
            if (!this._isValidEmailFormat(cleanEmail)) {
                return {
                    success: true,
                    email: cleanEmail,
                    valid: false,
                    reason: 'Invalid email format',
                    details: {
                        format: { valid: false },
                        disposable: { valid: true },
                        mx: { valid: false },
                        placeholder: { valid: false },
                        typo: { valid: true }
                    },
                    timestamp: new Date().toISOString()
                };
            }

            const [localPart, domain] = cleanEmail.split('@');

            // 2. Typo domain check
            const typoCheck = this._checkTypoDomain(domain);
            if (typoCheck.isTypo) {
                return {
                    success: true,
                    email: cleanEmail,
                    valid: false,
                    reason: `Domain appears to be a typo. Did you mean '${typoCheck.suggestedDomain}'?`,
                    details: {
                        format: { valid: true },
                        disposable: { valid: true },
                        mx: { valid: false },
                        placeholder: { valid: true },
                        typo: { 
                            valid: false, 
                            suggested: typoCheck.suggestedDomain 
                        }
                    },
                    timestamp: new Date().toISOString()
                };
            }

            // 3. Disposable email check
            const isDisposable = this._isDisposableEmail(domain);
            if (isDisposable) {
                return {
                    success: true,
                    email: cleanEmail,
                    valid: false,
                    reason: 'Disposable email address',
                    details: {
                        format: { valid: true },
                        disposable: { valid: false },
                        mx: { valid: false },
                        placeholder: { valid: true },
                        typo: { valid: true }
                    },
                    timestamp: new Date().toISOString()
                };
            }

            // 4. Placeholder/spam check
            if (this._isPlaceholderEmail(cleanEmail)) {
                return {
                    success: true,
                    email: cleanEmail,
                    valid: false,
                    reason: 'Placeholder or example email detected',
                    details: {
                        format: { valid: true },
                        disposable: { valid: true },
                        mx: { valid: false },
                        placeholder: { valid: false },
                        typo: { valid: true }
                    },
                    timestamp: new Date().toISOString()
                };
            }

            // 5. MX Record validation
            const hasMXRecord = await this._checkMXRecord(domain);

            return {
                success: true,
                email: cleanEmail,
                valid: hasMXRecord,
                reason: hasMXRecord ? null : 'No MX record found',
                details: {
                    format: { valid: true },
                    disposable: { valid: true },
                    mx: { valid: hasMXRecord },
                    placeholder: { valid: true },
                    typo: { valid: true }
                },
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            return {
                success: false,
                email: email,
                error: error.message,
                timestamp: new Date().toISOString()
            };
        } finally {
            // Update thread-safe statistics
            this._updateStatistics(arguments[0]); // Pass original email for context
        }
    }

    _updateStatistics(email) {
        // Simple atomic counter updates
        this.statistics.totalProcessed++;
        // Note: We could track more detailed stats here if needed
    }

    async validateBatch(emails, requestId = null) {
        const results = [];
        const totalEmails = emails.length;
        const logPrefix = requestId ? `[${requestId}]` : '';

        console.log(`${logPrefix} Starting validation of ${totalEmails} emails in batches of ${this.batchSize}`);

        for (let i = 0; i < emails.length; i += this.batchSize) {
            const batch = emails.slice(i, i + this.batchSize);
            const batchNumber = Math.floor(i / this.batchSize) + 1;
            const totalBatches = Math.ceil(emails.length / this.batchSize);

            console.log(`${logPrefix} Processing batch ${batchNumber}/${totalBatches} (${batch.length} emails)`);

            const batchResults = await this._processBatch(batch);
            results.push(...batchResults);

            this._logProgress(i + this.batchSize, totalEmails, logPrefix);
        }

        console.log(`${logPrefix} Validation completed for all ${totalEmails} emails`);
        return results;
    }

    async _processBatch(batch) {
        const promises = batch.map(email => this.validateSingle(email));
        return await Promise.all(promises);
    }

    _logProgress(processed, total, logPrefix) {
        const percentage = Math.min(Math.round((processed / total) * 100), 100);
        console.log(`${logPrefix} Progress: ${processed}/${total} emails processed (${percentage}%)`);
    }

    async validateExcelData(excelData, requestId = null) {
        const results = [];
        const logPrefix = requestId ? `[${requestId}]` : '';

        console.log(`${logPrefix} Starting Excel validation for ${excelData.length} rows`);

        for (let i = 0; i < excelData.length; i++) {
            const row = excelData[i];
            const emailField = this._findEmailInExcelRow(row);
            
            if (emailField) {
                const validationResult = await this.validateSingle(emailField);
                results.push({
                    ...row,
                    email_validation: validationResult.valid,
                    email_valid: validationResult.valid,
                    validation_reason: validationResult.reason || '',
                    validation_details: validationResult.details
                });
            } else {
                results.push({
                    ...row,
                    email_validation: false,
                    email_valid: false,
                    validation_reason: 'No email found in row',
                    validation_details: {}
                });
            }

            if ((i + 1) % 100 === 0 || i === excelData.length - 1) {
                console.log(`${logPrefix} Excel validation progress: ${i + 1}/${excelData.length} rows`);
            }
        }

        return results;
    }

    _findEmailInExcelRow(row) {
        // Look for email in common column names first
        for (const col of config.csv.emailColumns) {
            if (row[col] && typeof row[col] === 'string' && row[col].trim()) {
                return row[col].trim();
            }
        }
        
        // Fallback to first column
        const firstKey = Object.keys(row)[0];
        return row[firstKey] || null;
    }

    removeDuplicates(emails) {
        return [...new Set(emails.map(email => email.toLowerCase()))];
    }

    calculateStatistics(results) {
        const total = results.length;
        const successful = results.filter(r => r.success).length;
        const valid = results.filter(r => r.success && r.valid).length;
        const invalid = results.filter(r => r.success && !r.valid).length;
        const errors = results.filter(r => !r.success).length;

        return {
            total,
            successful,
            valid,
            invalid,
            errors,
            validPercentage: total > 0 ? Math.round((valid / total) * 100) : 0,
            invalidPercentage: total > 0 ? Math.round((invalid / total) * 100) : 0,
            errorPercentage: total > 0 ? Math.round((errors / total) * 100) : 0
        };
    }

    /**
     * Get MX cache statistics for performance monitoring
     * @returns {Object} Cache statistics
     */
    getCacheStatistics() {
        return this.mxCache.getStatistics();
    }

    /**
     * Clear MX cache
     */
    clearMxCache() {
        this.mxCache.flush();
    }

    /**
     * Get cached domains list (for debugging)
     * @returns {string[]} Array of cached domain names
     */
    getCachedDomains() {
        return this.mxCache.getCachedDomains();
    }
}

module.exports = EmailValidationService;