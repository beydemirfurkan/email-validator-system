"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResponseUtils = void 0;
const crypto_1 = require("crypto");
class ResponseUtils {
    static success(data) {
        return {
            success: true,
            data,
            timestamp: new Date().toISOString()
        };
    }
    static error(message, statusCode = 400, additionalData = {}) {
        return {
            success: false,
            error: message,
            timestamp: new Date().toISOString(),
            ...additionalData
        };
    }
    static validationError(message, example) {
        const error = this.error(message);
        if (example) {
            error.example = example;
        }
        return error;
    }
    static serverError(message, error) {
        return {
            success: false,
            error: message,
            message: error?.message || 'Unknown error',
            timestamp: new Date().toISOString()
        };
    }
    static batchValidationSuccess(results, statistics, processingInfo) {
        return this.success({
            totalEmails: statistics.total,
            validEmails: statistics.valid,
            invalidEmails: statistics.invalid,
            riskyEmails: 0,
            results,
            processingTime: 0
        });
    }
    static csvUploadSuccess(results, statistics, processingInfo, filename) {
        return this.success({
            source: 'csv_upload',
            filename,
            results,
            statistics,
            processing_info: processingInfo,
            export_info: {
                message: "Use POST /api/export-csv with the 'results' array to download CSV",
                total_results: results.length
            }
        });
    }
    static setFileDownloadHeaders(res, filename, contentType, headers = {}) {
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        Object.entries(headers).forEach(([key, value]) => {
            res.setHeader(key, value);
        });
    }
    static generateTimestamp() {
        return new Date().toISOString().replace(/[:.]/g, '-');
    }
    static generateRequestId() {
        return (0, crypto_1.randomUUID)().slice(0, 8);
    }
    static createProcessingInfo(originalCount, duplicatesRemoved, processedCount) {
        return {
            original_count: originalCount,
            duplicates_removed: duplicatesRemoved,
            processed: processedCount
        };
    }
    static createValidationStatistics(results) {
        const validCount = results.filter(r => r.valid === true || r.email_valid === true).length;
        const invalidCount = results.filter(r => r.valid === false || r.email_valid === false).length;
        const total = results.length;
        return {
            total,
            valid: validCount,
            invalid: invalidCount,
            validPercentage: total > 0 ? ((validCount / total) * 100).toFixed(2) : '0.00',
            invalidPercentage: total > 0 ? ((invalidCount / total) * 100).toFixed(2) : '0.00'
        };
    }
    static createPaginatedResponse(data, page, limit, total) {
        return {
            success: true,
            data,
            timestamp: new Date().toISOString(),
            meta: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        };
    }
}
exports.ResponseUtils = ResponseUtils;
//# sourceMappingURL=response.utils.js.map