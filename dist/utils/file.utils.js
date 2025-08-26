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
exports.FileUtils = void 0;
const csv_parser_1 = __importDefault(require("csv-parser"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const XLSX = __importStar(require("xlsx"));
const response_utils_1 = require("./response.utils");
class FileUtils {
    static emailColumns = ['email', 'Email', 'EMAIL', 'e-mail', 'E-mail', 'mail'];
    static async parseCSVEmails(filePath) {
        return new Promise((resolve, reject) => {
            const emails = [];
            fs_1.default.createReadStream(filePath)
                .pipe((0, csv_parser_1.default)())
                .on('data', (row) => {
                const emailValue = this.findEmailInRow(row);
                if (emailValue && typeof emailValue === 'string' && emailValue.trim()) {
                    emails.push(emailValue.trim());
                }
            })
                .on('end', () => resolve(emails))
                .on('error', reject);
        });
    }
    static parseExcelData(filePath) {
        const workbook = XLSX.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(worksheet);
        return data.filter((row) => {
            return this.findEmailInRow(row) !== null;
        });
    }
    static generateCSV(results) {
        const headers = ['email', 'valid', 'reason', 'score', 'format_valid', 'disposable_check', 'mx_valid', 'typo_check'];
        const csvRows = [headers.join(',')];
        results.forEach(result => {
            const email = this.escapeCSVField(result.email || '');
            const reason = this.escapeCSVField(result.reason?.join(', ') || '');
            const row = [
                email,
                result.valid || false,
                reason,
                result.score || 0,
                result.details?.format || false,
                !result.details?.disposable || false,
                result.details?.mx || false,
                !result.details?.typo || false
            ];
            csvRows.push(row.join(','));
        });
        return csvRows.join('\n');
    }
    static escapeCSVField(field) {
        let fieldStr = String(field);
        if (fieldStr.includes(',') || fieldStr.includes('"') || fieldStr.includes('\n') || fieldStr.includes('\r')) {
            return `"${fieldStr.replace(/"/g, '""')}"`;
        }
        return fieldStr;
    }
    static generateExcel(results) {
        const workbook = XLSX.utils.book_new();
        const worksheet = XLSX.utils.json_to_sheet(results);
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Email Validation Results');
        return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    }
    static generateFilename(originalName, suffix, extension) {
        const timestamp = response_utils_1.ResponseUtils.generateTimestamp();
        const baseName = originalName.replace(new RegExp(`\\${extension}$`, 'i'), '');
        return `${baseName}-${suffix}-${timestamp}${extension}`;
    }
    static createCSVExportHeaders(results, originalCount, duplicatesRemoved) {
        return {
            'X-Total-Emails': originalCount,
            'X-Duplicates-Removed': duplicatesRemoved,
            'X-Processed-Emails': results.length,
            'X-Valid-Emails': results.filter(r => r.valid).length,
            'X-Invalid-Emails': results.filter(r => !r.valid).length
        };
    }
    static createExcelExportHeaders(results) {
        const validCount = results.filter(r => r.email_valid === true).length;
        const invalidCount = results.filter(r => r.email_valid === false).length;
        return {
            'X-Total-Rows': results.length,
            'X-Valid-Emails': validCount,
            'X-Invalid-Emails': invalidCount
        };
    }
    static saveResultsToFile(results, originalFilename, format = 'csv') {
        const resultsDir = path_1.default.join(__dirname, '..', '..', 'results');
        if (!fs_1.default.existsSync(resultsDir)) {
            fs_1.default.mkdirSync(resultsDir, { recursive: true });
        }
        const timestamp = response_utils_1.ResponseUtils.generateTimestamp();
        const baseName = originalFilename.replace(/\.[^/.]+$/, '');
        const filename = `${baseName}-validation-results-${timestamp}.${format}`;
        const filePath = path_1.default.join(resultsDir, filename);
        try {
            if (format === 'csv') {
                const csvContent = this.generateCSV(results);
                fs_1.default.writeFileSync(filePath, '\uFEFF' + csvContent, 'utf8');
            }
            else if (format === 'xlsx') {
                const excelBuffer = this.generateExcel(results);
                fs_1.default.writeFileSync(filePath, excelBuffer);
            }
            console.log(`Results saved to: ${filePath}`);
            return filePath;
        }
        catch (error) {
            console.error('Error saving results to file:', error);
            throw error;
        }
    }
    static cleanupFile(filePath) {
        try {
            if (fs_1.default.existsSync(filePath)) {
                fs_1.default.unlinkSync(filePath);
            }
        }
        catch (error) {
            console.error('Error cleaning up file:', error);
        }
    }
    static findEmailInRow(row) {
        for (const col of this.emailColumns) {
            if (row[col] && typeof row[col] === 'string' && row[col].trim()) {
                return row[col];
            }
        }
        const firstKey = Object.keys(row)[0];
        return firstKey ? row[firstKey] || null : null;
    }
}
exports.FileUtils = FileUtils;
//# sourceMappingURL=file.utils.js.map