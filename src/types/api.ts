export interface ValidationResult {
  valid: boolean;
  email: string;
  score: number;
  reason: string[];
  details: {
    format: boolean;
    mx: boolean;
    smtp?: boolean;
    disposable: boolean;
    role: boolean;
    typo: boolean;
    suspicious: boolean;
    spamKeywords: boolean;
  };
  suggestion?: string;
  provider?: string;
  processingTime?: number;
  fromCache?: boolean;
  error?: any;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResponse<T> extends ApiResponse<T> {
  meta: PaginationMeta;
}

export interface HealthCheckResponse {
  status: 'ok' | 'error';
  timestamp: string;
  uptime: number;
  version: string;
  database: 'connected' | 'disconnected';
  cache?: {
    size: number;
    hitRate: number;
  };
}

export interface BatchValidationResult {
  totalEmails: number;
  validEmails: number;
  invalidEmails: number;
  riskyEmails: number;
  results: ValidationResult[];
  processingTime: number;
}

export interface StatsResponse {
  totalValidations: number;
  validEmails: number;
  invalidEmails: number;
  riskyEmails: number;
  averageProcessingTime: number;
  validationsToday: number;
  validationsThisMonth: number;
  topDomains: Array<{
    domain: string;
    count: number;
  }>;
}