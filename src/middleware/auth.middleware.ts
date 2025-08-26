import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { db } from '../database/connection';
import { users, apiKeys } from '../database/schema';
import { ResponseUtils } from '../utils/response.utils';

// Extend Express Request type to include user and apiKey
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        email: string;
        name: string;
        isActive: boolean;
      };
      apiKey?: {
        id: number;
        userId: number;
        keyName: string;
        rateLimit: number;
      };
    }
  }
}

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-key-change-in-production';

export class AuthMiddleware {
  // JWT token authentication
  static async authenticateToken(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

      if (!token) {
        res.status(401).json(ResponseUtils.error('Access token required', 401));
        return;
      }

      const decoded = jwt.verify(token, JWT_SECRET) as { userId: number };
      const user = await db.select().from(users).where(eq(users.id, decoded.userId)).limit(1);

      if (!user[0] || !user[0].isActive) {
        res.status(401).json(ResponseUtils.error('Invalid or expired token', 401));
        return;
      }

      req.user = {
        id: user[0].id,
        email: user[0].email,
        name: user[0].name,
        isActive: user[0].isActive ?? true
      };

      next();
    } catch (error) {
      res.status(401).json(ResponseUtils.error('Invalid token', 401));
    }
  }

  // Optional authentication - proceed even if no token
  static async optionalAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      const token = authHeader && authHeader.split(' ')[1];

      if (token) {
        try {
          const decoded = jwt.verify(token, JWT_SECRET) as { userId: number };
          const user = await db.select().from(users).where(eq(users.id, decoded.userId)).limit(1);

          if (user[0] && user[0].isActive) {
            req.user = {
              id: user[0].id,
              email: user[0].email,
              name: user[0].name,
              isActive: user[0].isActive ?? true
            };
          }
        } catch (error) {
          // Ignore token errors in optional auth
        }
      }

      next();
    } catch (error) {
      next();
    }
  }

  // API Key authentication
  static async authenticateApiKey(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const apiKeyHeader = req.headers['x-api-key'] || req.headers['api-key'];
      const apiKey = apiKeyHeader as string;

      if (!apiKey) {
        res.status(401).json(ResponseUtils.error('API key required', 401));
        return;
      }

      // Find API key in database
      const apiKeyRecords = await db.select().from(apiKeys).where(eq(apiKeys.isActive, true));
      
      let matchedApiKey = null;
      for (const record of apiKeyRecords) {
        const isValid = await bcrypt.compare(apiKey, record.apiKey);
        if (isValid) {
          matchedApiKey = record;
          break;
        }
      }

      if (!matchedApiKey) {
        res.status(401).json(ResponseUtils.error('Invalid API key', 401));
        return;
      }

      // Get user associated with API key
      const user = await db.select().from(users).where(eq(users.id, matchedApiKey.userId)).limit(1);

      if (!user[0] || !user[0].isActive) {
        res.status(401).json(ResponseUtils.error('API key associated with inactive user', 401));
        return;
      }

      // Update last used timestamp
      await db.update(apiKeys)
        .set({ lastUsedAt: new Date().toISOString() })
        .where(eq(apiKeys.id, matchedApiKey.id));

      req.user = {
        id: user[0].id,
        email: user[0].email,
        name: user[0].name,
        isActive: user[0].isActive ?? true
      };

      req.apiKey = {
        id: matchedApiKey.id,
        userId: matchedApiKey.userId,
        keyName: matchedApiKey.keyName,
        rateLimit: matchedApiKey.rateLimit ?? 100
      };

      next();
    } catch (error) {
      res.status(401).json(ResponseUtils.error('API key authentication failed', 401));
    }
  }

  // Generate JWT token
  static generateToken(userId: number): string {
    return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '24h' });
  }

  // Hash password
  static async hashPassword(password: string): Promise<string> {
    const salt = await bcrypt.genSalt(12);
    return bcrypt.hash(password, salt);
  }

  // Verify password
  static async verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword);
  }
}