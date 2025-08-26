import { ApiResponse, ValidationResult, BatchValidationResult } from '../types/api';
interface ProcessingInfo {
    original_count: number;
    duplicates_removed: number;
    processed: number;
}
interface ValidationStatistics {
    total: number;
    valid: number;
    invalid: number;
    validPercentage: string;
    invalidPercentage: string;
}
export declare class ResponseUtils {
    static success<T>(data: T): ApiResponse<T>;
    static error(message: string, statusCode?: number, additionalData?: Record<string, any>): ApiResponse;
    static validationError(message: string, example?: string): ApiResponse;
    static serverError(message: string, error?: Error): ApiResponse;
    static batchValidationSuccess(results: ValidationResult[], statistics: ValidationStatistics, processingInfo: ProcessingInfo): ApiResponse<BatchValidationResult>;
    static csvUploadSuccess(results: ValidationResult[], statistics: ValidationStatistics, processingInfo: ProcessingInfo, filename: string): ApiResponse<any>;
    static setFileDownloadHeaders(res: any, filename: string, contentType: string, headers?: Record<string, string | number>): void;
    static generateTimestamp(): string;
    static generateRequestId(): string;
    static createProcessingInfo(originalCount: number, duplicatesRemoved: number, processedCount: number): ProcessingInfo;
    static createValidationStatistics(results: ValidationResult[] | any[]): ValidationStatistics;
    static createPaginatedResponse<T>(data: T[], page: number, limit: number, total: number): ApiResponse<T[]> & {
        meta: {
            page: number;
            limit: number;
            total: number;
            totalPages: number;
        };
    };
}
export {};
//# sourceMappingURL=response.utils.d.ts.map