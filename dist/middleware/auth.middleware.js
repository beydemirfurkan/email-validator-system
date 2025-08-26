"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthMiddleware = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const drizzle_orm_1 = require("drizzle-orm");
const connection_1 = require("../database/connection");
const schema_1 = require("../database/schema");
const response_utils_1 = require("../utils/response.utils");
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-key-change-in-production';
class AuthMiddleware {
    static async authenticateToken(req, res, next) {
        try {
            const authHeader = req.headers.authorization;
            const token = authHeader && authHeader.split(' ')[1];
            if (!token) {
                res.status(401).json(response_utils_1.ResponseUtils.error('Access token required', 401));
                return;
            }
            const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
            const user = await connection_1.db.select().from(schema_1.users).where((0, drizzle_orm_1.eq)(schema_1.users.id, decoded.userId)).limit(1);
            if (!user[0] || !user[0].isActive) {
                res.status(401).json(response_utils_1.ResponseUtils.error('Invalid or expired token', 401));
                return;
            }
            req.user = {
                id: user[0].id,
                email: user[0].email,
                name: user[0].name,
                isActive: user[0].isActive ?? true
            };
            next();
        }
        catch (error) {
            res.status(401).json(response_utils_1.ResponseUtils.error('Invalid token', 401));
        }
    }
    static async optionalAuth(req, res, next) {
        try {
            const authHeader = req.headers.authorization;
            const token = authHeader && authHeader.split(' ')[1];
            if (token) {
                try {
                    const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
                    const user = await connection_1.db.select().from(schema_1.users).where((0, drizzle_orm_1.eq)(schema_1.users.id, decoded.userId)).limit(1);
                    if (user[0] && user[0].isActive) {
                        req.user = {
                            id: user[0].id,
                            email: user[0].email,
                            name: user[0].name,
                            isActive: user[0].isActive ?? true
                        };
                    }
                }
                catch (error) {
                }
            }
            next();
        }
        catch (error) {
            next();
        }
    }
    static async authenticateApiKey(req, res, next) {
        try {
            const apiKeyHeader = req.headers['x-api-key'] || req.headers['api-key'];
            const apiKey = apiKeyHeader;
            if (!apiKey) {
                res.status(401).json(response_utils_1.ResponseUtils.error('API key required', 401));
                return;
            }
            const apiKeyRecords = await connection_1.db.select().from(schema_1.apiKeys).where((0, drizzle_orm_1.eq)(schema_1.apiKeys.isActive, true));
            let matchedApiKey = null;
            for (const record of apiKeyRecords) {
                const isValid = await bcryptjs_1.default.compare(apiKey, record.apiKey);
                if (isValid) {
                    matchedApiKey = record;
                    break;
                }
            }
            if (!matchedApiKey) {
                res.status(401).json(response_utils_1.ResponseUtils.error('Invalid API key', 401));
                return;
            }
            if (matchedApiKey.expiresAt && matchedApiKey.expiresAt < new Date()) {
                res.status(401).json(response_utils_1.ResponseUtils.error('API key has expired', 401));
                return;
            }
            const user = await connection_1.db.select().from(schema_1.users).where((0, drizzle_orm_1.eq)(schema_1.users.id, matchedApiKey.userId)).limit(1);
            if (!user[0] || !user[0].isActive) {
                res.status(401).json(response_utils_1.ResponseUtils.error('API key associated with inactive user', 401));
                return;
            }
            await connection_1.db.update(schema_1.apiKeys)
                .set({ lastUsedAt: new Date() })
                .where((0, drizzle_orm_1.eq)(schema_1.apiKeys.id, matchedApiKey.id));
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
        }
        catch (error) {
            res.status(401).json(response_utils_1.ResponseUtils.error('API key authentication failed', 401));
        }
    }
    static generateToken(userId) {
        return jsonwebtoken_1.default.sign({ userId }, JWT_SECRET, { expiresIn: '24h' });
    }
    static async hashPassword(password) {
        const salt = await bcryptjs_1.default.genSalt(12);
        return bcryptjs_1.default.hash(password, salt);
    }
    static async verifyPassword(password, hashedPassword) {
        return bcryptjs_1.default.compare(password, hashedPassword);
    }
}
exports.AuthMiddleware = AuthMiddleware;
//# sourceMappingURL=auth.middleware.js.map