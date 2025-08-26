import { Request, Response, NextFunction } from 'express';
import { ResponseUtils } from '../utils/response.utils';
import { upstashCache } from '../services/upstash-cache.service';

interface RateLimitStore {
  [key: string]: {
    requests: number;
    resetTime: number;
  };
}

export class RateLimiterMiddleware {
  private static store: RateLimitStore = {};
  
  // Clean up expired entries every 5 minutes
  private static cleanup() {
    const now = Date.now();
    for (const key in this.store) {
      const entry = this.store[key];
      if (entry && entry.resetTime < now) {
        delete this.store[key];
      }
    }
  }

  // Initialize cleanup interval
  static {
    setInterval(() => this.cleanup(), 5 * 60 * 1000); // 5 minutes
  }

  // Create rate limiter middleware with Redis
  static create(options: {
    maxRequests: number;
    windowMs: number;
    message?: string;
    keyGenerator?: (req: Request) => string;
    skipSuccessfulRequests?: boolean;
  }) {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      const key = options.keyGenerator ? options.keyGenerator(req) : this.getSecureKey(req);
      const windowSeconds = Math.floor(options.windowMs / 1000);
      const identifier = req.ip || 'unknown';

      try {
        // Use Upstash for rate limiting
        const currentCount = await upstashCache.incrementRateLimit(key, windowSeconds, identifier);
        
        // Security headers
        res.setHeader('X-RateLimit-Limit', options.maxRequests.toString());
        res.setHeader('X-RateLimit-Remaining', Math.max(0, options.maxRequests - currentCount).toString());
        res.setHeader('X-RateLimit-Reset', new Date(Date.now() + options.windowMs).toISOString());
        res.setHeader('X-RateLimit-Window', windowSeconds.toString());

        if (currentCount > options.maxRequests) {
          // Log security event
          console.warn(`🚨 Rate limit exceeded: ${key} - ${currentCount}/${options.maxRequests}`);
          
          res.status(429).json({
            success: false,
            error: options.message || 'Too many requests, please try again later',
            retryAfter: Math.ceil(options.windowMs / 1000),
            limit: options.maxRequests,
            timestamp: new Date().toISOString()
          });
          return;
        }

        next();
      } catch (error) {
        // Fallback to memory-based limiting if cache fails
        console.error('Rate limiter cache error, falling back to memory:', error);
        this.fallbackRateLimit(req, res, next, options);
      }
    };
  }

  // Fallback rate limiter using memory
  private static fallbackRateLimit(
    req: Request, 
    res: Response, 
    next: NextFunction, 
    options: {
      maxRequests: number;
      windowMs: number;
      message?: string;
      keyGenerator?: (req: Request) => string;
    }
  ): void {
    const key = options.keyGenerator ? options.keyGenerator(req) : this.getDefaultKey(req);
    const now = Date.now();

    // Initialize or reset if window expired
    if (!this.store[key] || this.store[key].resetTime <= now) {
      this.store[key] = {
        requests: 0,
        resetTime: now + options.windowMs
      };
    }

    // Increment request count
    this.store[key].requests++;

    // Check if limit exceeded
    if (this.store[key].requests > options.maxRequests) {
      const resetTime = new Date(this.store[key].resetTime);
      res.status(429).json(ResponseUtils.error(
        options.message || 'Too many requests, please try again later',
        429,
        {
          retryAfter: Math.ceil((this.store[key].resetTime - now) / 1000),
          resetTime: resetTime.toISOString(),
          limit: options.maxRequests
        }
      ));
      return;
    }

    // Add rate limit headers
    const remaining = Math.max(0, options.maxRequests - this.store[key].requests);
    res.set({
      'X-RateLimit-Limit': options.maxRequests.toString(),
      'X-RateLimit-Remaining': remaining.toString(),
      'X-RateLimit-Reset': new Date(this.store[key].resetTime).toISOString(),
      'X-RateLimit-Window': (options.windowMs / 1000).toString()
    });

    next();
  }

  // Generate secure key for rate limiting
  private static getSecureKey(req: Request): string {
    // More secure key generation
    const crypto = require('crypto');
    
    if (req.apiKey) {
      return `api:${crypto.createHash('md5').update(req.apiKey.id.toString()).digest('hex')}`;
    }
    
    if (req.user) {
      return `user:${crypto.createHash('md5').update(req.user.id.toString()).digest('hex')}`;
    }

    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    return `ip:${crypto.createHash('md5').update(ip).digest('hex')}`;
  }

  // Generate key for rate limiting (legacy)
  private static getDefaultKey(req: Request): string {
    // Use API key if available, otherwise IP address
    if (req.apiKey) {
      return `api:${req.apiKey.id}`;
    }
    
    if (req.user) {
      return `user:${req.user.id}`;
    }

    return `ip:${req.ip || req.connection.remoteAddress || 'unknown'}`;
  }

  // API key specific rate limiter
  static apiKeyLimiter() {
    return (req: Request, res: Response, next: NextFunction): void => {
      if (!req.apiKey) {
        next();
        return;
      }

      const key = `api:${req.apiKey.id}`;
      const limit = req.apiKey.rateLimit; // requests per minute
      const windowMs = 60 * 1000; // 1 minute window
      const now = Date.now();

      // Initialize or reset if window expired
      if (!this.store[key] || this.store[key].resetTime <= now) {
        this.store[key] = {
          requests: 0,
          resetTime: now + windowMs
        };
      }

      // Increment request count
      this.store[key].requests++;

      // Check if limit exceeded
      if (this.store[key].requests > limit) {
        const resetTime = new Date(this.store[key].resetTime);
        res.status(429).json(ResponseUtils.error(
          `API key rate limit exceeded. Limit: ${limit} requests per minute`,
          429,
          {
            retryAfter: Math.ceil((this.store[key].resetTime - now) / 1000),
            resetTime: resetTime.toISOString(),
            limit
          }
        ));
        return;
      }

      // Add rate limit headers
      const remaining = Math.max(0, limit - this.store[key].requests);
      res.set({
        'X-RateLimit-Limit': limit.toString(),
        'X-RateLimit-Remaining': remaining.toString(),
        'X-RateLimit-Reset': new Date(this.store[key].resetTime).toISOString()
      });

      next();
    };
  }

  // Get current stats for a key
  static getStats(key: string): { requests: number; resetTime: number } | null {
    return this.store[key] || null;
  }

  // Clear rate limit for a key
  static clearKey(key: string): void {
    delete this.store[key];
  }

  // Clear all rate limits
  static clearAll(): void {
    this.store = {};
  }
}