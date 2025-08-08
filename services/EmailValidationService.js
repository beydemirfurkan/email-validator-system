const config = require('../config');
const fs = require('fs');
const path = require('path');

let validate;
try {
    validate = require('deep-email-validator');
    if (validate.default) {
        validate = validate.default;
    }
} catch (error) {
    console.error('Error importing deep-email-validator:', error);
    process.exit(1);
}

class EmailValidationService {
    constructor() {
        this.batchSize = config.validation.batchSize;
        this.validationOptions = {
            sender: config.validation.sender,
            ...config.validation.options
        };
        this.invalidPatterns = this._initializeInvalidPatterns();
    }

    _initializeInvalidPatterns() {
        const dataDir = path.join(__dirname, '..', 'data');
        
        try {
            const placeholderDomains = this._loadTextFile(path.join(dataDir, 'placeholder-domains.txt'));
            const spamKeywords = this._loadTextFile(path.join(dataDir, 'spam-keywords.txt'));

            return {
                placeholderDomains,
                spamKeywords
            };
        } catch (error) {
            console.error('Error loading invalid patterns from files:', error);
            console.error('Using fallback patterns as a safety measure');
            return {
                placeholderDomains: [],
                spamKeywords: []
            };
        }
    }

    _loadTextFile(filePath) {
        if (!fs.existsSync(filePath)) {
            console.warn(`Pattern file not found: ${filePath}`);
            return [];
        }
        
        const content = fs.readFileSync(filePath, 'utf8');
        return content
            .split('\n')
            .map(line => line.trim())
            .filter(line => line && !line.startsWith('#'));
    }


    _isPlaceholderEmail(email) {
        const emailLower = email.toLowerCase();
        const [localPart, domain] = emailLower.split('@');

        if (!localPart || !domain) return false;

        const isDomainPlaceholder = this.invalidPatterns.placeholderDomains.includes(domain);
        const containsSpamKeywords = this.invalidPatterns.spamKeywords.some(keyword =>
            localPart.includes(keyword) || domain.includes(keyword)
        );

        return isDomainPlaceholder || containsSpamKeywords;
    }

    async validateSingle(email) {
        try {
            const cleanEmail = email.trim().toLowerCase();

            if (this._isPlaceholderEmail(cleanEmail)) {
                return {
                    success: true,
                    email: cleanEmail,
                    valid: false,
                    reason: 'Placeholder or example email detected',
                    details: {
                        format: { valid: false },
                        typo: { valid: false },
                        disposable: { valid: false },
                        mx: { valid: false },
                        placeholder: { valid: false }
                    },
                    timestamp: new Date().toISOString()
                };
            }

            const validationResult = await validate({
                email: cleanEmail,
                ...this.validationOptions
            });

            return {
                success: true,
                email: cleanEmail,
                valid: validationResult.valid,
                reason: validationResult.reason || null,
                details: this._extractValidationDetails(validationResult),
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            return {
                success: false,
                email: email,
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
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

    async validateExcelData(excelData, requestId = null) {
        const results = [];
        const totalRows = excelData.length;
        const logPrefix = requestId ? `[${requestId}]` : '';

        console.log(`${logPrefix} Starting Excel validation of ${totalRows} rows in batches of ${this.batchSize}`);

        for (let i = 0; i < excelData.length; i += this.batchSize) {
            const batch = excelData.slice(i, i + this.batchSize);
            const batchNumber = Math.floor(i / this.batchSize) + 1;
            const totalBatches = Math.ceil(excelData.length / this.batchSize);

            console.log(`${logPrefix} Processing Excel batch ${batchNumber}/${totalBatches} (${batch.length} rows)`);

            const batchResults = await this._processExcelBatch(batch);
            results.push(...batchResults);

            this._logProgress(i + this.batchSize, totalRows, logPrefix, 'Excel');
        }

        console.log(`${logPrefix} Excel validation completed for all ${totalRows} rows`);
        return results;
    }

    calculateStatistics(results) {
        const total = results.length;
        const valid = results.filter(r => r.success && r.valid).length;
        const invalid = results.filter(r => r.success && !r.valid).length;
        const errors = results.filter(r => !r.success).length;

        const reasons = {};
        results.forEach(r => {
            if (r.success && r.reason) {
                reasons[r.reason] = (reasons[r.reason] || 0) + 1;
            }
        });

        return {
            total,
            valid,
            invalid,
            errors,
            validPercentage: total > 0 ? ((valid / total) * 100).toFixed(2) : '0.00',
            invalidPercentage: total > 0 ? ((invalid / total) * 100).toFixed(2) : '0.00',
            errorPercentage: total > 0 ? ((errors / total) * 100).toFixed(2) : '0.00',
            reasonBreakdown: reasons
        };
    }

    removeDuplicates(emails) {
        const uniqueEmails = [...new Set(emails.map(email =>
            typeof email === 'string' ? email.trim().toLowerCase() : email
        ))];
        return uniqueEmails;
    }

    async _processBatch(batch) {
        const batchPromises = batch.map(async (email) => {
            if (typeof email !== 'string') {
                return {
                    email: email,
                    success: false,
                    error: 'Invalid email format'
                };
            }

            try {
                const cleanEmail = email.trim().toLowerCase();

                if (this._isPlaceholderEmail(cleanEmail)) {
                    return {
                        email: cleanEmail,
                        success: true,
                        valid: false,
                        reason: 'Placeholder or example email detected',
                        details: {
                            format: { valid: false },
                            typo: { valid: false },
                            disposable: { valid: false },
                            mx: { valid: false },
                            placeholder: { valid: false }
                        }
                    };
                }

                const validationResult = await validate({
                    email: cleanEmail,
                    ...this.validationOptions
                });

                return {
                    email: cleanEmail,
                    success: true,
                    valid: validationResult.valid,
                    reason: validationResult.reason || null,
                    details: this._extractValidationDetails(validationResult)
                };
            } catch (error) {
                return {
                    email: email,
                    success: false,
                    error: error.message
                };
            }
        });

        return Promise.all(batchPromises);
    }

    async _processExcelBatch(batch) {
        const batchPromises = batch.map(async (row) => {
            const emailValue = this._findEmailInRow(row);
            const resultRow = { ...row };

            if (!emailValue) {
                return this._createFailedExcelResult(resultRow, 'No email found');
            }

            try {
                const cleanEmail = emailValue.toLowerCase();

                if (this._isPlaceholderEmail(cleanEmail)) {
                    const placeholderResult = {
                        valid: false,
                        reason: 'Placeholder or example email detected',
                        validators: {
                            regex: { valid: false },
                            typo: { valid: false },
                            disposable: { valid: false },
                            mx: { valid: false }
                        }
                    };
                    return this._createSuccessExcelResult(resultRow, placeholderResult);
                }

                const validationResult = await validate({
                    email: cleanEmail,
                    ...this.validationOptions
                });

                return this._createSuccessExcelResult(resultRow, validationResult);
            } catch (error) {
                return this._createFailedExcelResult(resultRow, error.message);
            }
        });

        return Promise.all(batchPromises);
    }

    _extractValidationDetails(validationResult) {
        return {
            format: validationResult.validators.regex,
            typo: validationResult.validators.typo,
            disposable: validationResult.validators.disposable,
            mx: validationResult.validators.mx
        };
    }

    _findEmailInRow(row) {
        for (const col of config.csv.emailColumns) {
            if (row[col] && typeof row[col] === 'string' && row[col].trim()) {
                return row[col].trim();
            }
        }
        return null;
    }

    _createSuccessExcelResult(resultRow, validationResult) {
        resultRow.email_valid = validationResult.valid;
        resultRow.validation_reason = validationResult.reason || '';
        resultRow.format_valid = validationResult.validators.regex?.valid || false;
        resultRow.typo_check = validationResult.validators.typo?.valid || false;
        resultRow.disposable_check = !validationResult.validators.disposable?.valid || false;
        resultRow.mx_valid = validationResult.validators.mx?.valid || false;
        return resultRow;
    }

    _createFailedExcelResult(resultRow, errorMessage) {
        resultRow.email_valid = false;
        resultRow.validation_reason = errorMessage;
        resultRow.format_valid = false;
        resultRow.typo_check = false;
        resultRow.disposable_check = false;
        resultRow.mx_valid = false;
        return resultRow;
    }

    _logProgress(processed, total, logPrefix, prefix = '') {
        const progress = ((processed / total) * 100).toFixed(1);
        const prefixText = prefix ? `${prefix} ` : '';
        console.log(`${logPrefix} ${prefixText}Progress: ${Math.min(processed, total)}/${total} (${progress}%)`);
    }
}

module.exports = EmailValidationService;