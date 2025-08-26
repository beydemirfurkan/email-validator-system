export declare enum LogLevel {
    ERROR = 0,
    WARN = 1,
    INFO = 2,
    DEBUG = 3
}
declare class Logger {
    private logLevel;
    private logDir;
    private maxLogSize;
    private maxLogFiles;
    constructor();
    private getLogLevel;
    private ensureLogDirectory;
    private formatLogEntry;
    private writeToFile;
    private rotateLogIfNeeded;
    private log;
    error(message: string, error?: Error, meta?: any): void;
    warn(message: string, meta?: any): void;
    info(message: string, meta?: any): void;
    debug(message: string, meta?: any): void;
    logRequest(req: any, res: any, responseTime?: number): void;
    logSecurityEvent(event: string, details: any, req?: any): void;
    logPerformance(operation: string, duration: number, meta?: any): void;
    logValidation(email: string, result: any, processingTime: number, userId?: number): void;
    logDatabaseOperation(operation: string, table: string, duration: number, error?: Error): void;
    logAuth(event: string, userId?: number, email?: string, success?: boolean, req?: any): void;
    private maskEmail;
    getLogFiles(): {
        name: string;
        size: number;
        modified: Date;
    }[];
    getLogStats(): any;
    cleanOldLogs(daysToKeep?: number): void;
}
export declare const logger: Logger;
export { Logger };
//# sourceMappingURL=logger.utils.d.ts.map