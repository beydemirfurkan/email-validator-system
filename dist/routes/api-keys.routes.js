"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.apiKeysRoutes = void 0;
const express_1 = require("express");
const drizzle_orm_1 = require("drizzle-orm");
const uuid_1 = require("uuid");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const connection_1 = require("../database/connection");
const schema_1 = require("../database/schema");
const auth_middleware_1 = require("../middleware/auth.middleware");
const response_utils_1 = require("../utils/response.utils");
const validation_1 = require("../types/validation");
const zod_1 = require("zod");
const router = (0, express_1.Router)();
exports.apiKeysRoutes = router;
router.use(auth_middleware_1.AuthMiddleware.authenticateToken);
router.get('/', async (req, res) => {
    try {
        const user = req.user;
        const userApiKeys = await connection_1.db.select({
            id: schema_1.apiKeys.id,
            keyName: schema_1.apiKeys.keyName,
            lastUsedAt: schema_1.apiKeys.lastUsedAt,
            isActive: schema_1.apiKeys.isActive,
            rateLimit: schema_1.apiKeys.rateLimit,
            createdAt: schema_1.apiKeys.createdAt
        })
            .from(schema_1.apiKeys)
            .where((0, drizzle_orm_1.eq)(schema_1.apiKeys.userId, user.id))
            .orderBy(schema_1.apiKeys.createdAt);
        return res.json(response_utils_1.ResponseUtils.success({
            apiKeys: userApiKeys,
            total: userApiKeys.length
        }));
    }
    catch (error) {
        console.error('API keys fetch error:', error);
        return res.status(500).json(response_utils_1.ResponseUtils.serverError('Failed to fetch API keys', error));
    }
});
router.post('/', async (req, res) => {
    try {
        const user = req.user;
        const validatedData = validation_1.apiKeyCreationSchema.parse(req.body);
        const { keyName, rateLimit } = validatedData;
        const existingKey = await connection_1.db.select()
            .from(schema_1.apiKeys)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.apiKeys.userId, user.id), (0, drizzle_orm_1.eq)(schema_1.apiKeys.keyName, keyName)))
            .limit(1);
        if (existingKey.length > 0) {
            return res.status(400).json(response_utils_1.ResponseUtils.error('API key with this name already exists', 400));
        }
        const rawKey = `evapi_${(0, uuid_1.v4)().replace(/-/g, '')}`;
        const salt = await bcryptjs_1.default.genSalt(12);
        const hashedKey = await bcryptjs_1.default.hash(rawKey, salt);
        const newApiKey = {
            userId: user.id,
            keyName,
            apiKey: hashedKey,
            rateLimit: rateLimit || 100,
            isActive: true
        };
        const createdKeys = await connection_1.db.insert(schema_1.apiKeys).values(newApiKey).returning({
            id: schema_1.apiKeys.id,
            keyName: schema_1.apiKeys.keyName,
            rateLimit: schema_1.apiKeys.rateLimit,
            isActive: schema_1.apiKeys.isActive,
            createdAt: schema_1.apiKeys.createdAt
        });
        const createdKey = createdKeys[0];
        if (!createdKey) {
            throw new Error('Failed to create API key');
        }
        return res.status(201).json(response_utils_1.ResponseUtils.success({
            message: 'API key created successfully',
            apiKey: {
                ...createdKey,
                key: rawKey
            },
            warning: 'This is the only time you will see the raw API key. Please save it securely.'
        }));
    }
    catch (error) {
        if (error instanceof zod_1.ZodError) {
            return res.status(400).json(response_utils_1.ResponseUtils.validationError(error.errors.map(e => e.message).join(', ')));
        }
        console.error('API key creation error:', error);
        return res.status(500).json(response_utils_1.ResponseUtils.serverError('Failed to create API key', error));
    }
});
router.get('/:id', async (req, res) => {
    try {
        const user = req.user;
        const { id } = req.params;
        const apiKeyId = parseInt(id);
        if (isNaN(apiKeyId)) {
            return res.status(400).json(response_utils_1.ResponseUtils.validationError('Invalid API key ID'));
        }
        const apiKeyRecords = await connection_1.db.select({
            id: schema_1.apiKeys.id,
            keyName: schema_1.apiKeys.keyName,
            lastUsedAt: schema_1.apiKeys.lastUsedAt,
            isActive: schema_1.apiKeys.isActive,
            rateLimit: schema_1.apiKeys.rateLimit,
            createdAt: schema_1.apiKeys.createdAt,
            updatedAt: schema_1.apiKeys.updatedAt
        })
            .from(schema_1.apiKeys)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.apiKeys.id, apiKeyId), (0, drizzle_orm_1.eq)(schema_1.apiKeys.userId, user.id)))
            .limit(1);
        const apiKey = apiKeyRecords[0];
        if (!apiKey) {
            return res.status(404).json(response_utils_1.ResponseUtils.error('API key not found', 404));
        }
        return res.json(response_utils_1.ResponseUtils.success({
            apiKey
        }));
    }
    catch (error) {
        console.error('API key fetch error:', error);
        return res.status(500).json(response_utils_1.ResponseUtils.serverError('Failed to fetch API key', error));
    }
});
router.put('/:id', async (req, res) => {
    try {
        const user = req.user;
        const { id } = req.params;
        const { keyName, rateLimit, isActive } = req.body;
        const apiKeyId = parseInt(id);
        if (isNaN(apiKeyId)) {
            return res.status(400).json(response_utils_1.ResponseUtils.validationError('Invalid API key ID'));
        }
        const existingKey = await connection_1.db.select()
            .from(schema_1.apiKeys)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.apiKeys.id, apiKeyId), (0, drizzle_orm_1.eq)(schema_1.apiKeys.userId, user.id)))
            .limit(1);
        if (existingKey.length === 0) {
            return res.status(404).json(response_utils_1.ResponseUtils.error('API key not found', 404));
        }
        const updates = {};
        if (keyName !== undefined) {
            if (typeof keyName !== 'string' || keyName.trim().length === 0) {
                return res.status(400).json(response_utils_1.ResponseUtils.validationError('Key name must be a non-empty string'));
            }
            const duplicateCheck = await connection_1.db.select()
                .from(schema_1.apiKeys)
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.apiKeys.userId, user.id), (0, drizzle_orm_1.eq)(schema_1.apiKeys.keyName, keyName.trim())))
                .limit(1);
            if (duplicateCheck.length > 0) {
                return res.status(400).json(response_utils_1.ResponseUtils.error('API key with this name already exists', 400));
            }
            updates.keyName = keyName.trim();
        }
        if (rateLimit !== undefined) {
            if (typeof rateLimit !== 'number' || rateLimit < 1 || rateLimit > 10000) {
                return res.status(400).json(response_utils_1.ResponseUtils.validationError('Rate limit must be between 1 and 10000 requests per minute'));
            }
            updates.rateLimit = rateLimit;
        }
        if (isActive !== undefined) {
            if (typeof isActive !== 'boolean') {
                return res.status(400).json(response_utils_1.ResponseUtils.validationError('isActive must be a boolean'));
            }
            updates.isActive = isActive;
        }
        const updatedKeys = await connection_1.db.update(schema_1.apiKeys)
            .set(updates)
            .where((0, drizzle_orm_1.eq)(schema_1.apiKeys.id, apiKeyId))
            .returning({
            id: schema_1.apiKeys.id,
            keyName: schema_1.apiKeys.keyName,
            lastUsedAt: schema_1.apiKeys.lastUsedAt,
            isActive: schema_1.apiKeys.isActive,
            rateLimit: schema_1.apiKeys.rateLimit,
            updatedAt: schema_1.apiKeys.updatedAt
        });
        const updatedKey = updatedKeys[0];
        if (!updatedKey) {
            throw new Error('Failed to update API key');
        }
        return res.json(response_utils_1.ResponseUtils.success({
            message: 'API key updated successfully',
            apiKey: updatedKey
        }));
    }
    catch (error) {
        console.error('API key update error:', error);
        return res.status(500).json(response_utils_1.ResponseUtils.serverError('Failed to update API key', error));
    }
});
router.delete('/:id', async (req, res) => {
    try {
        const user = req.user;
        const { id } = req.params;
        const apiKeyId = parseInt(id);
        if (isNaN(apiKeyId)) {
            return res.status(400).json(response_utils_1.ResponseUtils.validationError('Invalid API key ID'));
        }
        const deletedKeys = await connection_1.db.delete(schema_1.apiKeys)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.apiKeys.id, apiKeyId), (0, drizzle_orm_1.eq)(schema_1.apiKeys.userId, user.id)))
            .returning({
            id: schema_1.apiKeys.id,
            keyName: schema_1.apiKeys.keyName
        });
        if (deletedKeys.length === 0) {
            return res.status(404).json(response_utils_1.ResponseUtils.error('API key not found', 404));
        }
        const deletedKey = deletedKeys[0];
        if (!deletedKey) {
            throw new Error('Failed to delete API key');
        }
        return res.json(response_utils_1.ResponseUtils.success({
            message: 'API key deleted successfully',
            deletedKey: {
                id: deletedKey.id,
                keyName: deletedKey.keyName
            }
        }));
    }
    catch (error) {
        console.error('API key deletion error:', error);
        return res.status(500).json(response_utils_1.ResponseUtils.serverError('Failed to delete API key', error));
    }
});
router.post('/:id/regenerate', async (req, res) => {
    try {
        const user = req.user;
        const { id } = req.params;
        const apiKeyId = parseInt(id);
        if (isNaN(apiKeyId)) {
            return res.status(400).json(response_utils_1.ResponseUtils.validationError('Invalid API key ID'));
        }
        const existingKey = await connection_1.db.select()
            .from(schema_1.apiKeys)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.apiKeys.id, apiKeyId), (0, drizzle_orm_1.eq)(schema_1.apiKeys.userId, user.id)))
            .limit(1);
        if (existingKey.length === 0) {
            return res.status(404).json(response_utils_1.ResponseUtils.error('API key not found', 404));
        }
        const rawKey = `evapi_${(0, uuid_1.v4)().replace(/-/g, '')}`;
        const salt = await bcryptjs_1.default.genSalt(12);
        const hashedKey = await bcryptjs_1.default.hash(rawKey, salt);
        const updatedKeys = await connection_1.db.update(schema_1.apiKeys)
            .set({
            apiKey: hashedKey,
        })
            .where((0, drizzle_orm_1.eq)(schema_1.apiKeys.id, apiKeyId))
            .returning({
            id: schema_1.apiKeys.id,
            keyName: schema_1.apiKeys.keyName,
            rateLimit: schema_1.apiKeys.rateLimit,
            isActive: schema_1.apiKeys.isActive,
            updatedAt: schema_1.apiKeys.updatedAt
        });
        const updatedKey = updatedKeys[0];
        if (!updatedKey) {
            throw new Error('Failed to regenerate API key');
        }
        return res.json(response_utils_1.ResponseUtils.success({
            message: 'API key regenerated successfully',
            apiKey: {
                ...updatedKey,
                key: rawKey
            },
            warning: 'This is the only time you will see the new API key. Please save it securely. The old key is now invalid.'
        }));
    }
    catch (error) {
        console.error('API key regeneration error:', error);
        return res.status(500).json(response_utils_1.ResponseUtils.serverError('Failed to regenerate API key', error));
    }
});
//# sourceMappingURL=api-keys.routes.js.map