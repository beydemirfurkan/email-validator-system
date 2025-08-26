import { Router, Request, Response } from 'express';
import { eq, and } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import { db } from '../database/connection';
import { apiKeys, NewApiKey } from '../database/schema';
import { AuthMiddleware } from '../middleware/auth.middleware';
import { ResponseUtils } from '../utils/response.utils';
import { apiKeyCreationSchema } from '../types/validation';
import { ZodError } from 'zod';

const router = Router();

// All API key routes require authentication
router.use(AuthMiddleware.authenticateToken);

// GET /api/keys - List user's API keys
router.get('/', async (req: Request, res: Response) => {
  try {
    const user = req.user!;

    const userApiKeys = await db.select({
      id: apiKeys.id,
      keyName: apiKeys.keyName,
      lastUsedAt: apiKeys.lastUsedAt,
      isActive: apiKeys.isActive,
      rateLimit: apiKeys.rateLimit,
      createdAt: apiKeys.createdAt
    })
    .from(apiKeys)
    .where(eq(apiKeys.userId, user.id))
    .orderBy(apiKeys.createdAt);

    return res.json(ResponseUtils.success({
      apiKeys: userApiKeys,
      total: userApiKeys.length
    }));
  } catch (error) {
    console.error('API keys fetch error:', error);
    return res.status(500).json(
      ResponseUtils.serverError('Failed to fetch API keys', error as Error)
    );
  }
});

// POST /api/keys - Create new API key
router.post('/', async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const validatedData = apiKeyCreationSchema.parse(req.body);
    const { keyName, rateLimit } = validatedData;

    // Check if user already has an API key with this name
    const existingKey = await db.select()
      .from(apiKeys)
      .where(and(
        eq(apiKeys.userId, user.id),
        eq(apiKeys.keyName, keyName)
      ))
      .limit(1);

    if (existingKey.length > 0) {
      return res.status(400).json(
        ResponseUtils.error('API key with this name already exists', 400)
      );
    }

    // Generate raw API key
    const rawKey = `evapi_${uuidv4().replace(/-/g, '')}`;
    
    // Hash the API key for storage
    const salt = await bcrypt.genSalt(12);
    const hashedKey = await bcrypt.hash(rawKey, salt);

    // Create API key record
    const newApiKey: NewApiKey = {
      userId: user.id,
      keyName,
      apiKey: hashedKey,
      rateLimit: rateLimit || 100,
      isActive: true
    };

    const createdKeys = await db.insert(apiKeys).values(newApiKey).returning({
      id: apiKeys.id,
      keyName: apiKeys.keyName,
      rateLimit: apiKeys.rateLimit,
      isActive: apiKeys.isActive,
      createdAt: apiKeys.createdAt
    });

    const createdKey = createdKeys[0];
    if (!createdKey) {
      throw new Error('Failed to create API key');
    }

    return res.status(201).json(ResponseUtils.success({
      message: 'API key created successfully',
      apiKey: {
        ...createdKey,
        key: rawKey // Only show raw key once during creation
      },
      warning: 'This is the only time you will see the raw API key. Please save it securely.'
    }));
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json(
        ResponseUtils.validationError(
          error.errors.map(e => e.message).join(', ')
        )
      );
    }

    console.error('API key creation error:', error);
    return res.status(500).json(
      ResponseUtils.serverError('Failed to create API key', error as Error)
    );
  }
});

// GET /api/keys/:id - Get specific API key details
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const { id } = req.params;

    const apiKeyId = parseInt(id!);
    if (isNaN(apiKeyId)) {
      return res.status(400).json(
        ResponseUtils.validationError('Invalid API key ID')
      );
    }

    const apiKeyRecords = await db.select({
      id: apiKeys.id,
      keyName: apiKeys.keyName,
      lastUsedAt: apiKeys.lastUsedAt,
      isActive: apiKeys.isActive,
      rateLimit: apiKeys.rateLimit,
      createdAt: apiKeys.createdAt,
      updatedAt: apiKeys.updatedAt
    })
    .from(apiKeys)
    .where(and(
      eq(apiKeys.id, apiKeyId),
      eq(apiKeys.userId, user.id)
    ))
    .limit(1);

    const apiKey = apiKeyRecords[0];

    if (!apiKey) {
      return res.status(404).json(
        ResponseUtils.error('API key not found', 404)
      );
    }

    return res.json(ResponseUtils.success({
      apiKey
    }));
  } catch (error) {
    console.error('API key fetch error:', error);
    return res.status(500).json(
      ResponseUtils.serverError('Failed to fetch API key', error as Error)
    );
  }
});

// PUT /api/keys/:id - Update API key
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const { id } = req.params;
    const { keyName, rateLimit, isActive } = req.body;

    const apiKeyId = parseInt(id!);
    if (isNaN(apiKeyId)) {
      return res.status(400).json(
        ResponseUtils.validationError('Invalid API key ID')
      );
    }

    // Verify API key belongs to user
    const existingKey = await db.select()
      .from(apiKeys)
      .where(and(
        eq(apiKeys.id, apiKeyId),
        eq(apiKeys.userId, user.id)
      ))
      .limit(1);

    if (existingKey.length === 0) {
      return res.status(404).json(
        ResponseUtils.error('API key not found', 404)
      );
    }

    // Build update object
    const updates: Partial<NewApiKey> = {
      updatedAt: new Date().toISOString()
    };

    if (keyName !== undefined) {
      if (typeof keyName !== 'string' || keyName.trim().length === 0) {
        return res.status(400).json(
          ResponseUtils.validationError('Key name must be a non-empty string')
        );
      }
      
      // Check for duplicate names (exclude current key)
      const duplicateCheck = await db.select()
        .from(apiKeys)
        .where(and(
          eq(apiKeys.userId, user.id),
          eq(apiKeys.keyName, keyName.trim())
        ))
        .limit(1);

      if (duplicateCheck.length > 0) {
        return res.status(400).json(
          ResponseUtils.error('API key with this name already exists', 400)
        );
      }

      updates.keyName = keyName.trim();
    }

    if (rateLimit !== undefined) {
      if (typeof rateLimit !== 'number' || rateLimit < 1 || rateLimit > 10000) {
        return res.status(400).json(
          ResponseUtils.validationError('Rate limit must be between 1 and 10000 requests per minute')
        );
      }
      updates.rateLimit = rateLimit;
    }

    if (isActive !== undefined) {
      if (typeof isActive !== 'boolean') {
        return res.status(400).json(
          ResponseUtils.validationError('isActive must be a boolean')
        );
      }
      updates.isActive = isActive;
    }

    // Update API key
    const updatedKeys = await db.update(apiKeys)
      .set(updates)
      .where(eq(apiKeys.id, apiKeyId))
      .returning({
        id: apiKeys.id,
        keyName: apiKeys.keyName,
        lastUsedAt: apiKeys.lastUsedAt,
        isActive: apiKeys.isActive,
        rateLimit: apiKeys.rateLimit,
        updatedAt: apiKeys.updatedAt
      });

    const updatedKey = updatedKeys[0];
    if (!updatedKey) {
      throw new Error('Failed to update API key');
    }

    return res.json(ResponseUtils.success({
      message: 'API key updated successfully',
      apiKey: updatedKey
    }));
  } catch (error) {
    console.error('API key update error:', error);
    return res.status(500).json(
      ResponseUtils.serverError('Failed to update API key', error as Error)
    );
  }
});

// DELETE /api/keys/:id - Delete API key
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const { id } = req.params;

    const apiKeyId = parseInt(id!);
    if (isNaN(apiKeyId)) {
      return res.status(400).json(
        ResponseUtils.validationError('Invalid API key ID')
      );
    }

    // Verify API key belongs to user and delete
    const deletedKeys = await db.delete(apiKeys)
      .where(and(
        eq(apiKeys.id, apiKeyId),
        eq(apiKeys.userId, user.id)
      ))
      .returning({
        id: apiKeys.id,
        keyName: apiKeys.keyName
      });

    if (deletedKeys.length === 0) {
      return res.status(404).json(
        ResponseUtils.error('API key not found', 404)
      );
    }

    const deletedKey = deletedKeys[0];
    if (!deletedKey) {
      throw new Error('Failed to delete API key');
    }

    return res.json(ResponseUtils.success({
      message: 'API key deleted successfully',
      deletedKey: {
        id: deletedKey.id,
        keyName: deletedKey.keyName
      }
    }));
  } catch (error) {
    console.error('API key deletion error:', error);
    return res.status(500).json(
      ResponseUtils.serverError('Failed to delete API key', error as Error)
    );
  }
});

// POST /api/keys/:id/regenerate - Regenerate API key
router.post('/:id/regenerate', async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const { id } = req.params;

    const apiKeyId = parseInt(id!);
    if (isNaN(apiKeyId)) {
      return res.status(400).json(
        ResponseUtils.validationError('Invalid API key ID')
      );
    }

    // Verify API key belongs to user
    const existingKey = await db.select()
      .from(apiKeys)
      .where(and(
        eq(apiKeys.id, apiKeyId),
        eq(apiKeys.userId, user.id)
      ))
      .limit(1);

    if (existingKey.length === 0) {
      return res.status(404).json(
        ResponseUtils.error('API key not found', 404)
      );
    }

    // Generate new raw API key
    const rawKey = `evapi_${uuidv4().replace(/-/g, '')}`;
    
    // Hash the new API key
    const salt = await bcrypt.genSalt(12);
    const hashedKey = await bcrypt.hash(rawKey, salt);

    // Update API key in database
    const updatedKeys = await db.update(apiKeys)
      .set({ 
        apiKey: hashedKey,
        updatedAt: new Date().toISOString()
      })
      .where(eq(apiKeys.id, apiKeyId))
      .returning({
        id: apiKeys.id,
        keyName: apiKeys.keyName,
        rateLimit: apiKeys.rateLimit,
        isActive: apiKeys.isActive,
        updatedAt: apiKeys.updatedAt
      });

    const updatedKey = updatedKeys[0];
    if (!updatedKey) {
      throw new Error('Failed to regenerate API key');
    }

    return res.json(ResponseUtils.success({
      message: 'API key regenerated successfully',
      apiKey: {
        ...updatedKey,
        key: rawKey // Only show raw key once
      },
      warning: 'This is the only time you will see the new API key. Please save it securely. The old key is now invalid.'
    }));
  } catch (error) {
    console.error('API key regeneration error:', error);
    return res.status(500).json(
      ResponseUtils.serverError('Failed to regenerate API key', error as Error)
    );
  }
});

export { router as apiKeysRoutes };