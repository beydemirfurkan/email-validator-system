"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Logger = exports.logger = exports.LogLevel = void 0;
const fs_1 = require("fs");
const path_1 = require("path");
var LogLevel;
(function (LogLevel) {
    LogLevel[LogLevel["ERROR"] = 0] = "ERROR";
    LogLevel[LogLevel["WARN"] = 1] = "WARN";
    LogLevel[LogLevel["INFO"] = 2] = "INFO";
    LogLevel[LogLevel["DEBUG"] = 3] = "DEBUG";
})(LogLevel || (exports.LogLevel = LogLevel = {}));
class Logger {
    logLevel;
    logDir;
    maxLogSize;
    maxLogFiles;
    constructor() {
        this.logLevel = this.getLogLevel();
        this.logDir = (0, path_1.join)(process.cwd(), 'logs');
        this.maxLogSize = 10 * 1024 * 1024;
        this.maxLogFiles = 5;
        this.ensureLogDirectory();
    }
    getLogLevel() {
        const level = process.env.LOG_LEVEL?.toUpperCase() || 'INFO';
        switch (level) {
            case 'ERROR': return LogLevel.ERROR;
            case 'WARN': return LogLevel.WARN;
            case 'INFO': return LogLevel.INFO;
            case 'DEBUG': return LogLevel.DEBUG;
            default: return LogLevel.INFO;
        }
    }
    ensureLogDirectory() {
        if (!(0, fs_1.existsSync)(this.logDir)) {
            (0, fs_1.mkdirSync)(this.logDir, { recursive: true });
        }
    }
    formatLogEntry(entry) {
        return JSON.stringify(entry) + '\n';
    }
    writeToFile(filename, entry) {
        const logFile = (0, path_1.join)(this.logDir, filename);
        const formattedEntry = this.formatLogEntry(entry);
        try {
            (0, fs_1.appendFileSync)(logFile, formattedEntry);
            this.rotateLogIfNeeded(logFile);
        }
        catch (error) {
            console.error('Failed to write log:', error);
        }
    }
    rotateLogIfNeeded(logFile) {
        try {
            const fs = require('fs');
            const stats = fs.statSync(logFile);
            if (stats.size > this.maxLogSize) {
                for (let i = this.maxLogFiles - 1; i > 0; i--) {
                    const oldFile = `${logFile}.${i}`;
                    const newFile = `${logFile}.${i + 1}`;
                    if ((0, fs_1.existsSync)(oldFile)) {
                        if (i === this.maxLogFiles - 1) {
                            fs.unlinkSync(oldFile);
                        }
                        else {
                            fs.renameSync(oldFile, newFile);
                        }
                    }
                }
                fs.renameSync(logFile, `${logFile}.1`);
            }
        }
        catch (error) {
            console.error('Log rotation failed:', error);
        }
    }
    log(level, levelName, message, meta, error) {
        if (level > this.logLevel) {
            return;
        }
        const entry = {
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
        const filename = `app-${new Date().toISOString().split('T')[0]}.log`;
        this.writeToFile(filename, entry);
        if (level === LogLevel.ERROR) {
            const errorFilename = `error-${new Date().toISOString().split('T')[0]}.log`;
            this.writeToFile(errorFilename, entry);
        }
    }
    error(message, error, meta) {
        this.log(LogLevel.ERROR, 'ERROR', message, meta, error);
    }
    warn(message, meta) {
        this.log(LogLevel.WARN, 'WARN', message, meta);
    }
    info(message, meta) {
        this.log(LogLevel.INFO, 'INFO', message, meta);
    }
    debug(message, meta) {
        this.log(LogLevel.DEBUG, 'DEBUG', message, meta);
    }
    logRequest(req, res, responseTime) {
        const entry = {
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
        const accessLogFile = `access-${new Date().toISOString().split('T')[0]}.log`;
        this.writeToFile(accessLogFile, entry);
    }
    logSecurityEvent(event, details, req) {
        const entry = {
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
        const securityLogFile = `security-${new Date().toISOString().split('T')[0]}.log`;
        this.writeToFile(securityLogFile, entry);
        this.warn(`Security Event: ${event}`, { details, request: entry.request });
    }
    logPerformance(operation, duration, meta) {
        const entry = {
            timestamp: new Date().toISOString(),
            level: 'INFO',
            message: `Performance: ${operation}`,
            meta: {
                duration: `${duration}ms`,
                ...meta
            }
        };
        const perfLogFile = `performance-${new Date().toISOString().split('T')[0]}.log`;
        this.writeToFile(perfLogFile, entry);
        if (duration > 2000) {
            this.warn(`Slow operation detected: ${operation} took ${duration}ms`, meta);
        }
    }
    logValidation(email, result, processingTime, userId) {
        const entry = {
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
        const validationLogFile = `validation-${new Date().toISOString().split('T')[0]}.log`;
        this.writeToFile(validationLogFile, entry);
    }
    logDatabaseOperation(operation, table, duration, error) {
        const level = error ? LogLevel.ERROR : LogLevel.DEBUG;
        const levelName = error ? 'ERROR' : 'DEBUG';
        const entry = {
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
        const dbLogFile = `database-${new Date().toISOString().split('T')[0]}.log`;
        this.writeToFile(dbLogFile, entry);
        if (error) {
            this.error(`Database operation failed: ${operation} on ${table}`, error);
        }
        else if (duration > 1000) {
            this.warn(`Slow database operation: ${operation} on ${table} took ${duration}ms`);
        }
    }
    logAuth(event, userId, email, success = true, req) {
        const level = success ? LogLevel.INFO : LogLevel.WARN;
        const levelName = success ? 'INFO' : 'WARN';
        const entry = {
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
        const authLogFile = `auth-${new Date().toISOString().split('T')[0]}.log`;
        this.writeToFile(authLogFile, entry);
        if (!success) {
            this.warn(`Authentication failed: ${event}`, { userId, email: entry.meta.email });
        }
    }
    maskEmail(email) {
        if (!email || !email.includes('@'))
            return email;
        const [local, domain] = email.split('@');
        if (!local || !domain || local.length <= 2)
            return email;
        const maskedLocal = local[0] + '*'.repeat(local.length - 2) + local[local.length - 1];
        return `${maskedLocal}@${domain}`;
    }
    getLogFiles() {
        try {
            const fs = require('fs');
            const files = fs.readdirSync(this.logDir);
            return files
                .filter((file) => file.endsWith('.log'))
                .map((file) => {
                const filePath = (0, path_1.join)(this.logDir, file);
                const stats = fs.statSync(filePath);
                return {
                    name: file,
                    size: stats.size,
                    modified: stats.mtime
                };
            })
                .sort((a, b) => b.modified.getTime() - a.modified.getTime());
        }
        catch (error) {
            this.error('Failed to get log files', error);
            return [];
        }
    }
    getLogStats() {
        try {
            const files = this.getLogFiles();
            const totalSize = files.reduce((sum, file) => sum + file.size, 0);
            return {
                totalFiles: files.length,
                totalSize: Math.round(totalSize / 1024 / 1024 * 100) / 100,
                oldestLog: files.length > 0 ? files[files.length - 1]?.modified : null,
                newestLog: files.length > 0 ? files[0]?.modified : null,
                files: files.slice(0, 10)
            };
        }
        catch (error) {
            this.error('Failed to get log statistics', error);
            return {};
        }
    }
    cleanOldLogs(daysToKeep = 30) {
        try {
            const fs = require('fs');
            const cutoffDate = new Date(Date.now() - (daysToKeep * 24 * 60 * 60 * 1000));
            const files = fs.readdirSync(this.logDir);
            let deletedCount = 0;
            files.forEach((file) => {
                const filePath = (0, path_1.join)(this.logDir, file);
                const stats = fs.statSync(filePath);
                if (stats.mtime < cutoffDate) {
                    fs.unlinkSync(filePath);
                    deletedCount++;
                }
            });
            this.info(`Cleaned up ${deletedCount} old log files older than ${daysToKeep} days`);
        }
        catch (error) {
            this.error('Failed to clean old logs', error);
        }
    }
}
exports.Logger = Logger;
exports.logger = new Logger();
//# sourceMappingURL=logger.utils.js.map