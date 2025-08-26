import { ValidationResult } from '../types/api';
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
export declare class FileUtils {
    private static readonly emailColumns;
    static parseCSVEmails(filePath: string): Promise<string[]>;
    static parseExcelData(filePath: string): any[];
    static generateCSV(results: ValidationResult[]): string;
    private static escapeCSVField;
    static generateExcel(results: any[]): Buffer;
    static generateFilename(originalName: string, suffix: string, extension: string): string;
    static createCSVExportHeaders(results: ValidationResult[], originalCount: number, duplicatesRemoved: number): CSVExportHeaders;
    static createExcelExportHeaders(results: any[]): ExcelExportHeaders;
    static saveResultsToFile(results: ValidationResult[] | any[], originalFilename: string, format?: 'csv' | 'xlsx'): string;
    static cleanupFile(filePath: string): void;
    private static findEmailInRow;
}
export {};
//# sourceMappingURL=file.utils.d.ts.map