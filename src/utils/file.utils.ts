import csv from 'csv-parser';
import fs from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';
import { ValidationResult } from '../types/api';
import { ResponseUtils } from './response.utils';

interface CSVExportHeaders {
  'X-Total-Emails': number;
  'X-Duplicates-Removed': number;
  'X-Processed-Emails': number;
  'X-Valid-Emails': number;
  'X-Invalid-Emails': number;
}

interface ExcelExportHeaders {
  'X-Total-Rows': number;
  'X-Valid-Emails': number;
  'X-Invalid-Emails': number;
}

export class FileUtils {
  private static readonly emailColumns = ['email', 'Email', 'EMAIL', 'e-mail', 'E-mail', 'mail'];

  static async parseCSVEmails(filePath: string): Promise<string[]> {
    return new Promise((resolve, reject) => {
      const emails: string[] = [];
      
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (row: Record<string, any>) => {
          const emailValue = this.findEmailInRow(row);
          if (emailValue && typeof emailValue === 'string' && emailValue.trim()) {
            emails.push(emailValue.trim());
          }
        })
        .on('end', () => resolve(emails))
        .on('error', reject);
    });
  }

  static parseExcelData(filePath: string): any[] {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0]!;
    const worksheet = workbook.Sheets[sheetName]!;
    const data = XLSX.utils.sheet_to_json(worksheet);
    
    return data.filter((row: any) => {
      return this.findEmailInRow(row) !== null;
    });
  }

  static generateCSV(results: ValidationResult[]): string {
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

  private static escapeCSVField(field: string | number | boolean): string {
    let fieldStr = String(field);
    
    if (fieldStr.includes(',') || fieldStr.includes('"') || fieldStr.includes('\n') || fieldStr.includes('\r')) {
      return `"${fieldStr.replace(/"/g, '""')}"`;
    }
    
    return fieldStr;
  }

  static generateExcel(results: any[]): Buffer {
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(results);
    
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Email Validation Results');
    
    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  }

  static generateFilename(originalName: string, suffix: string, extension: string): string {
    const timestamp = ResponseUtils.generateTimestamp();
    const baseName = originalName.replace(new RegExp(`\\${extension}$`, 'i'), '');
    return `${baseName}-${suffix}-${timestamp}${extension}`;
  }

  static createCSVExportHeaders(results: ValidationResult[], originalCount: number, duplicatesRemoved: number): CSVExportHeaders {
    return {
      'X-Total-Emails': originalCount,
      'X-Duplicates-Removed': duplicatesRemoved,
      'X-Processed-Emails': results.length,
      'X-Valid-Emails': results.filter(r => r.valid).length,
      'X-Invalid-Emails': results.filter(r => !r.valid).length
    };
  }

  static createExcelExportHeaders(results: any[]): ExcelExportHeaders {
    const validCount = results.filter(r => r.email_valid === true).length;
    const invalidCount = results.filter(r => r.email_valid === false).length;
    
    return {
      'X-Total-Rows': results.length,
      'X-Valid-Emails': validCount,
      'X-Invalid-Emails': invalidCount
    };
  }

  static saveResultsToFile(results: ValidationResult[] | any[], originalFilename: string, format: 'csv' | 'xlsx' = 'csv'): string {
    const resultsDir = path.join(__dirname, '..', '..', 'results');
    
    if (!fs.existsSync(resultsDir)) {
      fs.mkdirSync(resultsDir, { recursive: true });
    }
    
    const timestamp = ResponseUtils.generateTimestamp();
    const baseName = originalFilename.replace(/\.[^/.]+$/, '');
    const filename = `${baseName}-validation-results-${timestamp}.${format}`;
    const filePath = path.join(resultsDir, filename);
    
    try {
      if (format === 'csv') {
        const csvContent = this.generateCSV(results as ValidationResult[]);
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

  static cleanupFile(filePath: string): void {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (error) {
      console.error('Error cleaning up file:', error);
    }
  }

  private static findEmailInRow(row: Record<string, any>): string | null {
    for (const col of this.emailColumns) {
      if (row[col] && typeof row[col] === 'string' && row[col].trim()) {
        return row[col];
      }
    }
    
    const firstKey = Object.keys(row)[0];
    return firstKey ? row[firstKey] || null : null;
  }
}