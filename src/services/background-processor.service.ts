import { EmailValidationService } from './email-validation.service';
import { FileUtils } from '../utils/file.utils';
import { ValidationResult } from '../types/api';

interface QueueJob {
  type: 'csv' | 'excel';
  filename: string;
  startTime: Date;
}

interface QueueStatus {
  totalProcessing: number;
  jobs: Array<{
    id: string;
    type: string;
    filename: string;
    startTime: Date;
  }>;
}

export class BackgroundProcessor {
  private readonly emailValidator: EmailValidationService;
  private readonly processingQueue = new Map<string, QueueJob>();

  constructor() {
    this.emailValidator = new EmailValidationService();
  }

  async processCSVFile(filePath: string, originalFilename: string, requestId: string): Promise<void> {
    try {
      console.log(`[${requestId}] Starting background CSV processing for: ${originalFilename}`);
      
      const emails = await FileUtils.parseCSVEmails(filePath);
      FileUtils.cleanupFile(filePath);

      if (emails.length === 0) {
        console.log(`[${requestId}] No valid emails found in CSV file`);
        return;
      }

      const uniqueEmails = this.emailValidator.removeDuplicates(emails);
      const duplicatesRemoved = emails.length - uniqueEmails.length;

      if (duplicatesRemoved > 0) {
        console.log(`[${requestId}] CSV Background: Removed ${duplicatesRemoved} duplicate emails`);
      }

      const results = await this.emailValidator.validateBatch(uniqueEmails, requestId);
      FileUtils.saveResultsToFile(results, originalFilename, 'csv');
      const logMessage = `[${requestId}] CSV background processing completed for: ${originalFilename}`;
      console.log(logMessage);
      this.processingQueue.delete(requestId);

    } catch (error: any) {
      const logMessage = `[${requestId}] CSV background processing error: ${error.message}`;
      console.error(logMessage);
      FileUtils.cleanupFile(filePath);
      this.processingQueue.delete(requestId);
    }
  }

  async processExcelFile(filePath: string, originalFilename: string, requestId: string): Promise<void> {
    try {
      console.log(`[${requestId}] Starting background Excel processing for: ${originalFilename}`);
      
      const excelData = FileUtils.parseExcelData(filePath);
      FileUtils.cleanupFile(filePath);

      if (excelData.length === 0) {
        console.log(`[${requestId}] No valid emails found in Excel file`);
        return;
      }

      console.log(`[${requestId}] Excel Background: Processing ${excelData.length} rows`);
      
      const results = await this.validateExcelData(excelData, requestId);
      FileUtils.saveResultsToFile(results, originalFilename, 'xlsx');
      
      console.log(`[${requestId}] Excel background processing completed for: ${originalFilename}`);
      this.processingQueue.delete(requestId);

    } catch (error: any) {
      const logMessage = `[${requestId}] Excel background processing error: ${error.message}`;
      console.error(logMessage);
      FileUtils.cleanupFile(filePath);
      this.processingQueue.delete(requestId);
    }
  }

  private async validateExcelData(excelData: any[], requestId: string): Promise<any[]> {
    const results: any[] = [];
    const logPrefix = requestId ? `[${requestId}]` : '';

    console.log(`${logPrefix} Starting Excel validation for ${excelData.length} rows`);

    for (let i = 0; i < excelData.length; i++) {
      const row = excelData[i];
      const emailField = this.findEmailInExcelRow(row);
      
      if (emailField) {
        const validationResult = await this.emailValidator.validateSingle(emailField);
        results.push({
          ...row,
          email_validation: validationResult.valid,
          email_valid: validationResult.valid,
          validation_reason: validationResult.reason?.join(', ') || '',
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

  private findEmailInExcelRow(row: Record<string, any>): string | null {
    // Common email column names
    const emailColumns = ['email', 'Email', 'EMAIL', 'e-mail', 'E-mail', 'mail'];
    
    for (const col of emailColumns) {
      if (row[col] && typeof row[col] === 'string' && row[col].trim()) {
        return row[col].trim();
      }
    }
    
    // Fallback to first column
    const firstKey = Object.keys(row)[0];
    return firstKey ? row[firstKey] || null : null;
  }

  queueCSVProcessing(filePath: string, originalFilename: string, requestId: string): string {
    this.processingQueue.set(requestId, {
      type: 'csv',
      filename: originalFilename,
      startTime: new Date()
    });

    setImmediate(() => {
      this.processCSVFile(filePath, originalFilename, requestId);
    });

    return requestId;
  }

  queueExcelProcessing(filePath: string, originalFilename: string, requestId: string): string {
    this.processingQueue.set(requestId, {
      type: 'excel',
      filename: originalFilename,
      startTime: new Date()
    });

    setImmediate(() => {
      this.processExcelFile(filePath, originalFilename, requestId);
    });

    return requestId;
  }

  getQueueStatus(): QueueStatus {
    return {
      totalProcessing: this.processingQueue.size,
      jobs: Array.from(this.processingQueue.entries()).map(([id, job]) => ({
        id,
        type: job.type,
        filename: job.filename,
        startTime: job.startTime
      }))
    };
  }
}

export const backgroundProcessor = new BackgroundProcessor();