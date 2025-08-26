import { Request, Response, NextFunction } from 'express';
export declare class RateLimiterMiddleware {
    private static store;
    private static cleanup;
    static create(options: {
        maxRequests: number;
        windowMs: number;
        message?: string;
        keyGenerator?: (req: Request) => string;
    }): (req: Request, res: Response, next: NextFunction) => void;
    private static getDefaultKey;
    static apiKeyLimiter(): (req: Request, res: Response, next: NextFunction) => void;
    static getStats(key: string): {
        requests: number;
        resetTime: number;
    } | null;
    static clearKey(key: string): void;
    static clearAll(): void;
}
//# sourceMappingURL=rate-limiter.middleware.d.ts.map