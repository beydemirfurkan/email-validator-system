const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const config = require('../config');
const ResponseUtils = require('./responseUtils');

class FileUtils {
    static async parseCSVEmails(filePath) {
        return new Promise((resolve, reject) => {
            const emails = [];
            
            fs.createReadStream(filePath)
                .pipe(csv())
                .on('data', (row) => {
                    const emailValue = this._findEmailInRow(row);
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
        
        return data.filter(row => {
            return this._findEmailInRow(row) !== null;
        });
    }

    static generateCSV(results) {
        const headers = ['email', 'valid', 'reason', 'format_valid', 'disposable_check', 'mx_valid', 'placeholder_check'];
        const csvRows = [headers.join(',')];
        
        results.forEach(result => {
            const email = this._escapeCSVField(result.email || '');
            const reason = this._escapeCSVField(result.reason || result.error || '');
            
            if (result.success) {
                const row = [
                    email,
                    result.valid || false,
                    reason,
                    result.details?.format?.valid || false,
                    result.details?.disposable?.valid || false,
                    result.details?.mx?.valid || false,
                    result.details?.placeholder?.valid || false
                ];
                csvRows.push(row.join(','));
            } else {
                const row = [email, false, reason, false, false, false, false];
                csvRows.push(row.join(','));
            }
        });
        
        return csvRows.join('\n');
    }

    static _escapeCSVField(field) {
        if (typeof field !== 'string') {
            field = String(field);
        }
        
        if (field.includes(',') || field.includes('"') || field.includes('\n') || field.includes('\r')) {
            return `"${field.replace(/"/g, '""')}"`;
        }
        
        return field;
    }

    static generateExcel(results) {
        const workbook = XLSX.utils.book_new();
        const worksheet = XLSX.utils.json_to_sheet(results);
        
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Email Validation Results');
        
        return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    }

    static generateFilename(originalName, suffix, extension) {
        const timestamp = ResponseUtils.generateTimestamp();
        const baseName = originalName.replace(new RegExp(`\\${extension}$`, 'i'), '');
        return `${baseName}-${suffix}-${timestamp}${extension}`;
    }

    static createCSVExportHeaders(results, originalCount, duplicatesRemoved) {
        return {
            'X-Total-Emails': originalCount,
            'X-Duplicates-Removed': duplicatesRemoved,
            'X-Processed-Emails': results.length,
            'X-Valid-Emails': results.filter(r => r.success && r.valid).length,
            'X-Invalid-Emails': results.filter(r => r.success && !r.valid).length
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
        const resultsDir = path.join(__dirname, '..', 'results');
        
        if (!fs.existsSync(resultsDir)) {
            fs.mkdirSync(resultsDir, { recursive: true });
        }
        
        const timestamp = ResponseUtils.generateTimestamp();
        const baseName = originalFilename.replace(/\.[^/.]+$/, '');
        const filename = `${baseName}-validation-results-${timestamp}.${format}`;
        const filePath = path.join(resultsDir, filename);
        
        try {
            if (format === 'csv') {
                const csvContent = this.generateCSV(results);
                fs.writeFileSync(filePath, '\uFEFF' + csvContent, 'utf8');
            } else if (format === 'xlsx') {
                const excelBuffer = this.generateExcel(results);
                fs.writeFileSync(filePath, excelBuffer);
            }
            
            console.log(`Results saved to: ${filePath}`);
            return filePath;
        } catch (error) {
            console.error('Error saving results to file:', error);
            throw error;
        }
    }

    static cleanupFile(filePath) {
        try {
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        } catch (error) {
            console.error('Error cleaning up file:', error);
        }
    }

    static _findEmailInRow(row) {
        for (const col of config.csv.emailColumns) {
            if (row[col] && typeof row[col] === 'string' && row[col].trim()) {
                return row[col];
            }
        }
        
        const firstKey = Object.keys(row)[0];
        return row[firstKey] || null;
    }
}

module.exports = FileUtils;