import { writeFileSync, appendFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3
}

interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  meta?: any;
  error?: {
    message: string;
    stack?: string;
  };
  request?: {
    method: string;
    url: string;
    ip?: string;
    userId?: number;
    userAgent?: string;
  };
}

class Logger {
  private logLevel: LogLevel;
  private logDir: string;
  private maxLogSize: number; // in bytes
  private maxLogFiles: number;

  constructor() {
    this.logLevel = this.getLogLevel();
    this.logDir = join(process.cwd(), 'logs');
    this.maxLogSize = 10 * 1024 * 1024; // 10MB
    this.maxLogFiles = 5;

    this.ensureLogDirectory();
  }

  private getLogLevel(): LogLevel {
    const level = process.env.LOG_LEVEL?.toUpperCase() || 'INFO';
    switch (level) {
      case 'ERROR': return LogLevel.ERROR;
      case 'WARN': return LogLevel.WARN;
      case 'INFO': return LogLevel.INFO;
      case 'DEBUG': return LogLevel.DEBUG;
      default: return LogLevel.INFO;
    }
  }

  private ensureLogDirectory(): void {
    if (!existsSync(this.logDir)) {
      mkdirSync(this.logDir, { recursive: true });
    }
  }

  private formatLogEntry(entry: LogEntry): string {
    return JSON.stringify(entry) + '\n';
  }

  private writeToFile(filename: string, entry: LogEntry): void {
    const logFile = join(this.logDir, filename);
    const formattedEntry = this.formatLogEntry(entry);

    try {
      appendFileSync(logFile, formattedEntry);
      this.rotateLogIfNeeded(logFile);
    } catch (error) {
      console.error('Failed to write log:', error);
    }
  }

  private rotateLogIfNeeded(logFile: string): void {
    try {
      const fs = require('fs');
      const stats = fs.statSync(logFile);
      
      if (stats.size > this.maxLogSize) {
        // Rotate logs
        for (let i = this.maxLogFiles - 1; i > 0; i--) {
          const oldFile = `${logFile}.${i}`;
          const newFile = `${logFile}.${i + 1}`;
          
          if (existsSync(oldFile)) {
            if (i === this.maxLogFiles - 1) {
              fs.unlinkSync(oldFile); // Delete oldest log
            } else {
              fs.renameSync(oldFile, newFile);
            }
          }
        }
        
        // Move current log to .1
        fs.renameSync(logFile, `${logFile}.1`);
      }
    } catch (error) {
      console.error('Log rotation failed:', error);
    }
  }

  private log(level: LogLevel, levelName: string, message: string, meta?: any, error?: Error): void {
    if (level > this.logLevel) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: levelName,
      message
    };

    if (meta) {
      entry.meta = meta;
    }

    if (error) {
      entry.error = {
        message: error.message,
        ...(error.stack && { stack: error.stack })
      };
    }

    // Console output
    const consoleMessage = `${entry.timestamp} [${levelName}] ${message}`;
    switch (level) {
      case LogLevel.ERROR:
        console.error(consoleMessage, error || meta || '');
        break;
      case LogLevel.WARN:
        console.warn(consoleMessage, meta || '');
        break;
      case LogLevel.INFO:
        console.info(consoleMessage, meta || '');
        break;
      case LogLevel.DEBUG:
        console.debug(consoleMessage, meta || '');
        break;
    }

    // File output
    const filename = `app-${new Date().toISOString().split('T')[0]}.log`;
    this.writeToFile(filename, entry);

    // Separate error log
    if (level === LogLevel.ERROR) {
      const errorFilename = `error-${new Date().toISOString().split('T')[0]}.log`;
      this.writeToFile(errorFilename, entry);
    }
  }

  error(message: string, error?: Error, meta?: any): void {
    this.log(LogLevel.ERROR, 'ERROR', message, meta, error);
  }

  warn(message: string, meta?: any): void {
    this.log(LogLevel.WARN, 'WARN', message, meta);
  }

  info(message: string, meta?: any): void {
    this.log(LogLevel.INFO, 'INFO', message, meta);
  }

  debug(message: string, meta?: any): void {
    this.log(LogLevel.DEBUG, 'DEBUG', message, meta);
  }

  // Request-specific logging
  logRequest(req: any, res: any, responseTime?: number): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: 'INFO',
      message: 'HTTP Request',
      request: {
        method: req.method,
        url: req.url,
        ip: req.ip || req.connection.remoteAddress,
        userId: req.user?.id,
        userAgent: req.headers['user-agent']
      },
      meta: {
        statusCode: res.statusCode,
        responseTime: responseTime ? `${responseTime}ms` : undefined,
        contentLength: res.get('content-length')
      }
    };

    // Log to access log file
    const accessLogFile = `access-${new Date().toISOString().split('T')[0]}.log`;
    this.writeToFile(accessLogFile, entry);
  }

  // Security event logging
  logSecurityEvent(event: string, details: any, req?: any): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: 'WARN',
      message: `Security Event: ${event}`,
      meta: {
        ...details,
        severity: 'HIGH'
      }
    };

    if (req) {
      entry.request = {
        method: req.method,
        url: req.url,
        ip: req.ip || req.connection.remoteAddress,
        userId: req.user?.id,
        userAgent: req.headers['user-agent']
      };
    }

    // Log to security log file
    const securityLogFile = `security-${new Date().toISOString().split('T')[0]}.log`;
    this.writeToFile(securityLogFile, entry);

    // Also log as warning
    this.warn(`Security Event: ${event}`, { details, request: entry.request });
  }

  // Performance logging
  logPerformance(operation: string, duration: number, meta?: any): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: 'INFO',
      message: `Performance: ${operation}`,
      meta: {
        duration: `${duration}ms`,
        ...meta
      }
    };

    // Log to performance log file
    const perfLogFile = `performance-${new Date().toISOString().split('T')[0]}.log`;
    this.writeToFile(perfLogFile, entry);

    // Warn for slow operations
    if (duration > 2000) {
      this.warn(`Slow operation detected: ${operation} took ${duration}ms`, meta);
    }
  }

  // Email validation specific logging
  logValidation(email: string, result: any, processingTime: number, userId?: number): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: 'INFO',
      message: 'Email Validation',
      meta: {
        email: this.maskEmail(email),
        valid: result.valid,
        score: result.score,
        processingTime: `${processingTime}ms`,
        userId,
        checks: result.checks
      }
    };

    // Log to validation log file
    const validationLogFile = `validation-${new Date().toISOString().split('T')[0]}.log`;
    this.writeToFile(validationLogFile, entry);
  }

  // Database operation logging
  logDatabaseOperation(operation: string, table: string, duration: number, error?: Error): void {
    const level = error ? LogLevel.ERROR : LogLevel.DEBUG;
    const levelName = error ? 'ERROR' : 'DEBUG';

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: levelName,
      message: `Database Operation: ${operation}`,
      meta: {
        table,
        duration: `${duration}ms`,
        success: !error
      }
    };

    if (error) {
      entry.error = {
        message: error.message,
        ...(error.stack && { stack: error.stack })
      };
    }

    // Log to database log file
    const dbLogFile = `database-${new Date().toISOString().split('T')[0]}.log`;
    this.writeToFile(dbLogFile, entry);

    if (error) {
      this.error(`Database operation failed: ${operation} on ${table}`, error);
    } else if (duration > 1000) {
      this.warn(`Slow database operation: ${operation} on ${table} took ${duration}ms`);
    }
  }

  // Authentication logging
  logAuth(event: string, userId?: number, email?: string, success: boolean = true, req?: any): void {
    const level = success ? LogLevel.INFO : LogLevel.WARN;
    const levelName = success ? 'INFO' : 'WARN';

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: levelName,
      message: `Auth Event: ${event}`,
      meta: {
        userId,
        email: email ? this.maskEmail(email) : undefined,
        success,
        severity: success ? 'NORMAL' : 'MEDIUM'
      }
    };

    if (req) {
      entry.request = {
        method: req.method,
        url: req.url,
        ip: req.ip || req.connection.remoteAddress,
        userAgent: req.headers['user-agent']
      };
    }

    // Log to auth log file
    const authLogFile = `auth-${new Date().toISOString().split('T')[0]}.log`;
    this.writeToFile(authLogFile, entry);

    if (!success) {
      this.warn(`Authentication failed: ${event}`, { userId, email: entry.meta.email });
    }
  }

  // Utility method to mask sensitive information
  private maskEmail(email: string): string {
    if (!email || !email.includes('@')) return email;
    
    const [local, domain] = email.split('@');
    if (local.length <= 2) return email;
    
    const maskedLocal = local[0] + '*'.repeat(local.length - 2) + local[local.length - 1];
    return `${maskedLocal}@${domain}`;
  }

  // Get log files info
  getLogFiles(): { name: string; size: number; modified: Date }[] {
    try {
      const fs = require('fs');
      const files = fs.readdirSync(this.logDir);
      
      return files
        .filter(file => file.endsWith('.log'))
        .map(file => {
          const filePath = join(this.logDir, file);
          const stats = fs.statSync(filePath);
          
          return {
            name: file,
            size: stats.size,
            modified: stats.mtime
          };
        })
        .sort((a, b) => b.modified.getTime() - a.modified.getTime());
    } catch (error) {
      this.error('Failed to get log files', error as Error);
      return [];
    }
  }

  // Get log statistics
  getLogStats(): any {
    try {
      const files = this.getLogFiles();
      const totalSize = files.reduce((sum, file) => sum + file.size, 0);
      
      return {
        totalFiles: files.length,
        totalSize: Math.round(totalSize / 1024 / 1024 * 100) / 100, // MB
        oldestLog: files.length > 0 ? files[files.length - 1]?.modified : null,
        newestLog: files.length > 0 ? files[0]?.modified : null,
        files: files.slice(0, 10) // Last 10 files
      };
    } catch (error) {
      this.error('Failed to get log statistics', error as Error);
      return {};
    }
  }

  // Clean old logs
  cleanOldLogs(daysToKeep: number = 30): void {
    try {
      const fs = require('fs');
      const cutoffDate = new Date(Date.now() - (daysToKeep * 24 * 60 * 60 * 1000));
      const files = fs.readdirSync(this.logDir);
      
      let deletedCount = 0;
      
      files.forEach((file: string) => {
        const filePath = join(this.logDir, file);
        const stats = fs.statSync(filePath);
        
        if (stats.mtime < cutoffDate) {
          fs.unlinkSync(filePath);
          deletedCount++;
        }
      });
      
      this.info(`Cleaned up ${deletedCount} old log files older than ${daysToKeep} days`);
    } catch (error) {
      this.error('Failed to clean old logs', error as Error);
    }
  }
}

// Export singleton instance
export const logger = new Logger();

// Export for testing
export { Logger };