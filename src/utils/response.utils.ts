import { randomUUID } from 'crypto';
import { ApiResponse, ValidationResult, BatchValidationResult, StatsResponse } from '../types/api';

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

export class ResponseUtils {
  static success<T>(data: T): ApiResponse<T> {
    return {
      success: true,
      data,
      timestamp: new Date().toISOString()
    };
  }

  static error(message: string, statusCode: number = 400, additionalData: Record<string, any> = {}): ApiResponse {
    return {
      success: false,
      error: message,
      timestamp: new Date().toISOString(),
      ...additionalData
    };
  }

  static validationError(message: string, example?: string): ApiResponse {
    const error: ApiResponse = this.error(message);
    if (example) {
      (error as any).example = example;
    }
    return error;
  }

  static serverError(message: string, error?: Error): ApiResponse {
    return {
      success: false,
      error: message,
      message: error?.message || 'Unknown error',
      timestamp: new Date().toISOString()
    };
  }

  static batchValidationSuccess(results: ValidationResult[], statistics: ValidationStatistics, processingInfo: ProcessingInfo): ApiResponse<BatchValidationResult> {
    return this.success({
      totalEmails: statistics.total,
      validEmails: statistics.valid,
      invalidEmails: statistics.invalid,
      riskyEmails: 0, // Can be calculated based on score ranges
      results,
      processingTime: 0 // Can be added if needed
    });
  }

  static csvUploadSuccess(results: ValidationResult[], statistics: ValidationStatistics, processingInfo: ProcessingInfo, filename: string): ApiResponse<any> {
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

  static setFileDownloadHeaders(res: any, filename: string, contentType: string, headers: Record<string, string | number> = {}): void {
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    Object.entries(headers).forEach(([key, value]) => {
      res.setHeader(key, value);
    });
  }

  static generateTimestamp(): string {
    return new Date().toISOString().replace(/[:.]/g, '-');
  }

  static generateRequestId(): string {
    return randomUUID().slice(0, 8);
  }

  static createProcessingInfo(originalCount: number, duplicatesRemoved: number, processedCount: number): ProcessingInfo {
    return {
      original_count: originalCount,
      duplicates_removed: duplicatesRemoved,
      processed: processedCount
    };
  }

  static createValidationStatistics(results: ValidationResult[] | any[]): ValidationStatistics {
    // Handle both ValidationResult[] and Excel results
    const validCount = results.filter(r => 
      r.valid === true || r.email_valid === true
    ).length;
    const invalidCount = results.filter(r => 
      r.valid === false || r.email_valid === false
    ).length;
    const total = results.length;

    return {
      total,
      valid: validCount,
      invalid: invalidCount,
      validPercentage: total > 0 ? ((validCount / total) * 100).toFixed(2) : '0.00',
      invalidPercentage: total > 0 ? ((invalidCount / total) * 100).toFixed(2) : '0.00'
    };
  }

  static createPaginatedResponse<T>(
    data: T[], 
    page: number, 
    limit: number, 
    total: number
  ): ApiResponse<T[]> & { meta: { page: number; limit: number; total: number; totalPages: number } } {
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