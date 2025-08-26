import { CacheStatistics } from './mx-cache.service';
import { ValidationResult } from '../types/api';
interface ValidationConfig {
    batchSize: number;
}
export declare class EmailValidationService {
    private readonly batchSize;
    private readonly invalidPatterns;
    private readonly disposableDomains;
    private readonly mxCache;
    private readonly statistics;
    constructor(config?: ValidationConfig);
    private initializeInvalidPatterns;
    private loadTextFile;
    private loadTypoDomains;
    private normalizeInternationalEmail;
    private isValidEmailFormat;
    private hasRestrictedCharacters;
    private hasDynamicSuspiciousPatterns;
    private hasExcessiveRepeatingChars;
    private isAllSameCharacter;
    private hasSequentialPattern;
    private looksRandomGenerated;
    private isValidPlusAddressing;
    private isDisposableEmail;
    private checkTypoDomain;
    private isPlaceholderEmail;
    private hasSignificantSpamPatterns;
    private isSpamDominant;
    private checkMXRecord;
    validateSingle(email: string): Promise<ValidationResult>;
    private updateStatistics;
    validateBatch(emails: string[], requestId?: string): Promise<ValidationResult[]>;
    private processBatch;
    private logProgress;
    removeDuplicates(emails: string[]): string[];
    calculateStatistics(results: ValidationResult[]): {
        total: number;
        valid: number;
        invalid: number;
        validPercentage: number;
        invalidPercentage: number;
    };
    getCacheStatistics(): CacheStatistics;
    clearMxCache(): void;
    getCachedDomains(): string[];
}
export {};
//# sourceMappingURL=email-validation.service.d.ts.map