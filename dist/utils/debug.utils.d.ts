import { Request, Response, NextFunction } from 'express';
declare class DebugUtils {
    private static requestMetrics;
    private static maxMetricsHistory;
    private static performanceThreshold;
    static requestLogger(): (req: Request, res: Response, next: NextFunction) => void;
    static errorTracker(): (error: Error, req: Request, res: Response, next: NextFunction) => void;
    static getRequestMetrics(): {
        totalRequests: number;
        errorCount: number;
        errorRate: number;
        averageResponseTime: number;
        slowRequestCount: number;
        endpointStats: {
            [key: string]: any;
        };
    };
    static getMemoryStats(): {
        memory: {
            rss: number;
            heapTotal: number;
            heapUsed: number;
            external: number;
            heapUsagePercentage: string;
        };
        cpu: {
            user: number;
            system: number;
        };
        uptime: number;
        pid: number;
        nodeVersion: string;
        platform: NodeJS.Platform;
    };
    static getDatabaseStats(): Promise<{
        healthy: boolean;
        stats: any;
        issues: string[];
    } | {
        healthy: boolean;
        error: string;
        stats: {};
    }>;
    static getValidationStats(): {
        cacheStats: any;
        cacheSize: any;
        hitRate: any;
        error?: undefined;
    } | {
        error: string;
        cacheStats: null;
        cacheSize?: undefined;
        hitRate?: undefined;
    };
    static getSystemHealth(): Promise<{
        status: string;
        healthScore: number;
        issues: string[];
        timestamp: string;
        uptime: number;
        components: {
            memory: {
                memory: {
                    rss: number;
                    heapTotal: number;
                    heapUsed: number;
                    external: number;
                    heapUsagePercentage: string;
                };
                cpu: {
                    user: number;
                    system: number;
                };
                uptime: number;
                pid: number;
                nodeVersion: string;
                platform: NodeJS.Platform;
            };
            requests: {
                totalRequests: number;
                errorCount: number;
                errorRate: number;
                averageResponseTime: number;
                slowRequestCount: number;
                endpointStats: {
                    [key: string]: any;
                };
            };
            database: {
                healthy: boolean;
                stats: any;
                issues: string[];
            } | {
                healthy: boolean;
                error: string;
                stats: {};
            };
            validation: {
                cacheStats: any;
                cacheSize: any;
                hitRate: any;
                error?: undefined;
            } | {
                error: string;
                cacheStats: null;
                cacheSize?: undefined;
                hitRate?: undefined;
            };
        };
    }>;
    static createProfiler(operationName: string): {
        end: () => {
            operation: string;
            duration: number;
            memoryDelta: number;
            timestamp: string;
        };
    };
    static debugRequest(options: {
        userId?: number;
        endpoint?: string;
        method?: string;
        timeRange?: number;
    }): {
        matchingRequests: number;
        requests: {
            timestamp: string;
            method: string;
            url: string;
            duration: number | undefined;
            statusCode: number | undefined;
            error: string | undefined;
        }[];
    };
    static clearMetrics(): void;
    static exportMetrics(): string;
}
export { DebugUtils };
//# sourceMappingURL=debug.utils.d.ts.map