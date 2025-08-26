"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RateLimiterMiddleware = void 0;
const response_utils_1 = require("../utils/response.utils");
class RateLimiterMiddleware {
    static store = {};
    static cleanup() {
        const now = Date.now();
        for (const key in this.store) {
            const entry = this.store[key];
            if (entry && entry.resetTime < now) {
                delete this.store[key];
            }
        }
    }
    static {
        setInterval(() => this.cleanup(), 5 * 60 * 1000);
    }
    static create(options) {
        return (req, res, next) => {
            const key = options.keyGenerator ? options.keyGenerator(req) : this.getDefaultKey(req);
            const now = Date.now();
            if (!this.store[key] || this.store[key].resetTime <= now) {
                this.store[key] = {
                    requests: 0,
                    resetTime: now + options.windowMs
                };
            }
            this.store[key].requests++;
            if (this.store[key].requests > options.maxRequests) {
                const resetTime = new Date(this.store[key].resetTime);
                res.status(429).json(response_utils_1.ResponseUtils.error(options.message || 'Too many requests, please try again later', 429, {
                    retryAfter: Math.ceil((this.store[key].resetTime - now) / 1000),
                    resetTime: resetTime.toISOString(),
                    limit: options.maxRequests
                }));
                return;
            }
            const remaining = Math.max(0, options.maxRequests - this.store[key].requests);
            res.set({
                'X-RateLimit-Limit': options.maxRequests.toString(),
                'X-RateLimit-Remaining': remaining.toString(),
                'X-RateLimit-Reset': new Date(this.store[key].resetTime).toISOString(),
                'X-RateLimit-Window': (options.windowMs / 1000).toString()
            });
            next();
        };
    }
    static getDefaultKey(req) {
        if (req.apiKey) {
            return `api:${req.apiKey.id}`;
        }
        if (req.user) {
            return `user:${req.user.id}`;
        }
        return `ip:${req.ip || req.connection.remoteAddress || 'unknown'}`;
    }
    static apiKeyLimiter() {
        return (req, res, next) => {
            if (!req.apiKey) {
                next();
                return;
            }
            const key = `api:${req.apiKey.id}`;
            const limit = req.apiKey.rateLimit;
            const windowMs = 60 * 1000;
            const now = Date.now();
            if (!this.store[key] || this.store[key].resetTime <= now) {
                this.store[key] = {
                    requests: 0,
                    resetTime: now + windowMs
                };
            }
            this.store[key].requests++;
            if (this.store[key].requests > limit) {
                const resetTime = new Date(this.store[key].resetTime);
                res.status(429).json(response_utils_1.ResponseUtils.error(`API key rate limit exceeded. Limit: ${limit} requests per minute`, 429, {
                    retryAfter: Math.ceil((this.store[key].resetTime - now) / 1000),
                    resetTime: resetTime.toISOString(),
                    limit
                }));
                return;
            }
            const remaining = Math.max(0, limit - this.store[key].requests);
            res.set({
                'X-RateLimit-Limit': limit.toString(),
                'X-RateLimit-Remaining': remaining.toString(),
                'X-RateLimit-Reset': new Date(this.store[key].resetTime).toISOString()
            });
            next();
        };
    }
    static getStats(key) {
        return this.store[key] || null;
    }
    static clearKey(key) {
        delete this.store[key];
    }
    static clearAll() {
        this.store = {};
    }
}
exports.RateLimiterMiddleware = RateLimiterMiddleware;
//# sourceMappingURL=rate-limiter.middleware.js.map