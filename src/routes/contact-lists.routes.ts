import { Router, Request, Response } from 'express';
import { eq, and, desc, count } from 'drizzle-orm';
import { db } from '../database/connection';
import { contactLists, contacts, NewContactList } from '../database/schema';
import { AuthMiddleware } from '../middleware/auth.middleware';
import { ResponseUtils } from '../utils/response.utils';
import { contactListSchema } from '../types/validation';
import { ZodError } from 'zod';

const router = Router();

// All contact list routes require authentication
router.use(AuthMiddleware.authenticateToken);

// GET /api/contact-lists - List user's contact lists
router.get('/', async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const { page = '1', limit = '10', search } = req.query;

    const pageNum = Math.max(1, parseInt(page as string) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string) || 10));
    const offset = (pageNum - 1) * limitNum;

    // Build query
    let query = db.select({
      id: contactLists.id,
      name: contactLists.name,
      description: contactLists.description,
      totalContacts: contactLists.totalContacts,
      validContacts: contactLists.validContacts,
      invalidContacts: contactLists.invalidContacts,
      riskyContacts: contactLists.riskyContacts,
      unknownContacts: contactLists.unknownContacts,
      lastValidatedAt: contactLists.lastValidatedAt,
      tags: contactLists.tags,
      isActive: contactLists.isActive,
      createdAt: contactLists.createdAt,
      updatedAt: contactLists.updatedAt
    })
    .from(contactLists)
    .where(and(
      eq(contactLists.userId, user.id),
      eq(contactLists.isActive, true)
    ));

    // Add search filter if provided
    if (search && typeof search === 'string') {
      // For SQLite, we'll use a simple LIKE pattern (Drizzle will handle it)
      // In a more advanced setup, you might use full-text search
    }

    const userContactLists = await query
      .orderBy(desc(contactLists.createdAt))
      .limit(limitNum)
      .offset(offset);

    // Get total count
    const totalResult = await db.select({ count: count() })
      .from(contactLists)
      .where(and(
        eq(contactLists.userId, user.id),
        eq(contactLists.isActive, true)
      ));

    const total = totalResult[0]?.count || 0;

    return res.json(ResponseUtils.createPaginatedResponse(
      userContactLists,
      pageNum,
      limitNum,
      total
    ));
  } catch (error) {
    console.error('Contact lists fetch error:', error);
    return res.status(500).json(
      ResponseUtils.serverError('Failed to fetch contact lists', error as Error)
    );
  }
});

// POST /api/contact-lists - Create new contact list
router.post('/', async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const validatedData = contactListSchema.parse(req.body);
    const { name, description, tags } = validatedData;

    // Check if user already has a contact list with this name
    const existingList = await db.select()
      .from(contactLists)
      .where(and(
        eq(contactLists.userId, user.id),
        eq(contactLists.name, name),
        eq(contactLists.isActive, true)
      ))
      .limit(1);

    if (existingList.length > 0) {
      return res.status(400).json(
        ResponseUtils.error('Contact list with this name already exists', 400)
      );
    }

    // Create contact list
    const newContactList: NewContactList = {
      userId: user.id,
      name,
      description: description || null,
      tags: tags ? JSON.stringify(tags) : null,
      totalContacts: 0,
      validContacts: 0,
      invalidContacts: 0,
      riskyContacts: 0,
      unknownContacts: 0,
      isActive: true
    };

    const createdLists = await db.insert(contactLists).values(newContactList).returning({
      id: contactLists.id,
      name: contactLists.name,
      description: contactLists.description,
      totalContacts: contactLists.totalContacts,
      validContacts: contactLists.validContacts,
      invalidContacts: contactLists.invalidContacts,
      riskyContacts: contactLists.riskyContacts,
      unknownContacts: contactLists.unknownContacts,
      tags: contactLists.tags,
      isActive: contactLists.isActive,
      createdAt: contactLists.createdAt
    });

    const createdList = createdLists[0];
    if (!createdList) {
      throw new Error('Failed to create contact list');
    }

    return res.status(201).json(ResponseUtils.success({
      message: 'Contact list created successfully',
      contactList: {
        ...createdList,
        tags: createdList.tags ? JSON.parse(createdList.tags as string) : []
      }
    }));
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json(
        ResponseUtils.validationError(
          error.errors.map(e => e.message).join(', ')
        )
      );
    }

    console.error('Contact list creation error:', error);
    return res.status(500).json(
      ResponseUtils.serverError('Failed to create contact list', error as Error)
    );
  }
});

// GET /api/contact-lists/:id - Get specific contact list details
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const { id } = req.params;

    const listId = parseInt(id!);
    if (isNaN(listId)) {
      return res.status(400).json(
        ResponseUtils.validationError('Invalid contact list ID')
      );
    }

    const contactListRecords = await db.select()
      .from(contactLists)
      .where(and(
        eq(contactLists.id, listId),
        eq(contactLists.userId, user.id),
        eq(contactLists.isActive, true)
      ))
      .limit(1);

    const contactList = contactListRecords[0];

    if (!contactList) {
      return res.status(404).json(
        ResponseUtils.error('Contact list not found', 404)
      );
    }

    return res.json(ResponseUtils.success({
      contactList: {
        ...contactList,
        tags: contactList.tags ? JSON.parse(contactList.tags as string) : []
      }
    }));
  } catch (error) {
    console.error('Contact list fetch error:', error);
    return res.status(500).json(
      ResponseUtils.serverError('Failed to fetch contact list', error as Error)
    );
  }
});

// PUT /api/contact-lists/:id - Update contact list
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const { id } = req.params;
    const { name, description, tags, isActive } = req.body;

    const listId = parseInt(id!);
    if (isNaN(listId)) {
      return res.status(400).json(
        ResponseUtils.validationError('Invalid contact list ID')
      );
    }

    // Verify contact list belongs to user
    const existingList = await db.select()
      .from(contactLists)
      .where(and(
        eq(contactLists.id, listId),
        eq(contactLists.userId, user.id)
      ))
      .limit(1);

    if (existingList.length === 0) {
      return res.status(404).json(
        ResponseUtils.error('Contact list not found', 404)
      );
    }

    // Build update object
    const updates: Partial<NewContactList> = {
      updatedAt: new Date()
    };

    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length === 0) {
        return res.status(400).json(
          ResponseUtils.validationError('Name must be a non-empty string')
        );
      }
      
      // Check for duplicate names
      const duplicateCheck = await db.select()
        .from(contactLists)
        .where(and(
          eq(contactLists.userId, user.id),
          eq(contactLists.name, name.trim()),
          eq(contactLists.isActive, true)
        ))
        .limit(1);

      if (duplicateCheck.length > 0 && duplicateCheck[0]?.id !== listId) {
        return res.status(400).json(
          ResponseUtils.error('Contact list with this name already exists', 400)
        );
      }

      updates.name = name.trim();
    }

    if (description !== undefined) {
      updates.description = typeof description === 'string' ? description.trim() || null : null;
    }

    if (tags !== undefined) {
      if (Array.isArray(tags)) {
        updates.tags = JSON.stringify(tags);
      } else {
        return res.status(400).json(
          ResponseUtils.validationError('Tags must be an array')
        );
      }
    }

    if (isActive !== undefined) {
      if (typeof isActive !== 'boolean') {
        return res.status(400).json(
          ResponseUtils.validationError('isActive must be a boolean')
        );
      }
      updates.isActive = isActive;
    }

    // Update contact list
    const updatedLists = await db.update(contactLists)
      .set(updates)
      .where(eq(contactLists.id, listId))
      .returning();

    const updatedList = updatedLists[0];
    if (!updatedList) {
      throw new Error('Failed to update contact list');
    }

    return res.json(ResponseUtils.success({
      message: 'Contact list updated successfully',
      contactList: {
        ...updatedList,
        tags: updatedList.tags ? JSON.parse(updatedList.tags as string) : []
      }
    }));
  } catch (error) {
    console.error('Contact list update error:', error);
    return res.status(500).json(
      ResponseUtils.serverError('Failed to update contact list', error as Error)
    );
  }
});

// DELETE /api/contact-lists/:id - Delete contact list (soft delete)
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const { id } = req.params;

    const listId = parseInt(id!);
    if (isNaN(listId)) {
      return res.status(400).json(
        ResponseUtils.validationError('Invalid contact list ID')
      );
    }

    // Soft delete contact list and its contacts
    const deletedLists = await db.update(contactLists)
      .set({ 
        isActive: false,
        updatedAt: new Date()
      })
      .where(and(
        eq(contactLists.id, listId),
        eq(contactLists.userId, user.id)
      ))
      .returning({
        id: contactLists.id,
        name: contactLists.name
      });

    if (deletedLists.length === 0) {
      return res.status(404).json(
        ResponseUtils.error('Contact list not found', 404)
      );
    }

    // Also soft delete all contacts in this list
    await db.update(contacts)
      .set({ updatedAt: new Date() })
      .where(eq(contacts.contactListId, listId));

    const deletedList = deletedLists[0];

    return res.json(ResponseUtils.success({
      message: 'Contact list deleted successfully',
      deletedList: {
        id: deletedList!.id,
        name: deletedList!.name
      }
    }));
  } catch (error) {
    console.error('Contact list deletion error:', error);
    return res.status(500).json(
      ResponseUtils.serverError('Failed to delete contact list', error as Error)
    );
  }
});

// GET /api/contact-lists/:id/statistics - Get contact list statistics
router.get('/:id/statistics', async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const { id } = req.params;

    const listId = parseInt(id!);
    if (isNaN(listId)) {
      return res.status(400).json(
        ResponseUtils.validationError('Invalid contact list ID')
      );
    }

    // Verify contact list belongs to user
    const contactList = await db.select()
      .from(contactLists)
      .where(and(
        eq(contactLists.id, listId),
        eq(contactLists.userId, user.id),
        eq(contactLists.isActive, true)
      ))
      .limit(1);

    if (contactList.length === 0) {
      return res.status(404).json(
        ResponseUtils.error('Contact list not found', 404)
      );
    }

    const list = contactList[0]!;

    // Calculate percentages
    const total = list.totalContacts || 0;
    const valid = list.validContacts || 0;
    const invalid = list.invalidContacts || 0;
    const risky = list.riskyContacts || 0;
    const unknown = list.unknownContacts || 0;

    return res.json(ResponseUtils.success({
      statistics: {
        total,
        valid,
        invalid,
        risky,
        unknown,
        validPercentage: total > 0 ? ((valid / total) * 100).toFixed(2) : '0.00',
        invalidPercentage: total > 0 ? ((invalid / total) * 100).toFixed(2) : '0.00',
        riskyPercentage: total > 0 ? ((risky / total) * 100).toFixed(2) : '0.00',
        unknownPercentage: total > 0 ? ((unknown / total) * 100).toFixed(2) : '0.00',
        lastValidatedAt: list.lastValidatedAt
      }
    }));
  } catch (error) {
    console.error('Contact list statistics error:', error);
    return res.status(500).json(
      ResponseUtils.serverError('Failed to fetch statistics', error as Error)
    );
  }
});

export { router as contactListsRoutes };