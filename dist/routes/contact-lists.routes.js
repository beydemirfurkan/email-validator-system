"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.contactListsRoutes = void 0;
const express_1 = require("express");
const drizzle_orm_1 = require("drizzle-orm");
const connection_1 = require("../database/connection");
const schema_1 = require("../database/schema");
const auth_middleware_1 = require("../middleware/auth.middleware");
const response_utils_1 = require("../utils/response.utils");
const validation_1 = require("../types/validation");
const zod_1 = require("zod");
const router = (0, express_1.Router)();
exports.contactListsRoutes = router;
router.use(auth_middleware_1.AuthMiddleware.authenticateToken);
router.get('/', async (req, res) => {
    try {
        const user = req.user;
        const { page = '1', limit = '10', search } = req.query;
        const pageNum = Math.max(1, parseInt(page) || 1);
        const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 10));
        const offset = (pageNum - 1) * limitNum;
        let query = connection_1.db.select({
            id: schema_1.contactLists.id,
            name: schema_1.contactLists.name,
            description: schema_1.contactLists.description,
            totalContacts: schema_1.contactLists.totalContacts,
            validContacts: schema_1.contactLists.validContacts,
            invalidContacts: schema_1.contactLists.invalidContacts,
            riskyContacts: schema_1.contactLists.riskyContacts,
            unknownContacts: schema_1.contactLists.unknownContacts,
            lastValidatedAt: schema_1.contactLists.lastValidatedAt,
            tags: schema_1.contactLists.tags,
            isActive: schema_1.contactLists.isActive,
            createdAt: schema_1.contactLists.createdAt,
            updatedAt: schema_1.contactLists.updatedAt
        })
            .from(schema_1.contactLists)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.contactLists.userId, user.id), (0, drizzle_orm_1.eq)(schema_1.contactLists.isActive, true)));
        if (search && typeof search === 'string') {
        }
        const userContactLists = await query
            .orderBy((0, drizzle_orm_1.desc)(schema_1.contactLists.createdAt))
            .limit(limitNum)
            .offset(offset);
        const totalResult = await connection_1.db.select({ count: (0, drizzle_orm_1.count)() })
            .from(schema_1.contactLists)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.contactLists.userId, user.id), (0, drizzle_orm_1.eq)(schema_1.contactLists.isActive, true)));
        const total = totalResult[0]?.count || 0;
        return res.json(response_utils_1.ResponseUtils.createPaginatedResponse(userContactLists, pageNum, limitNum, total));
    }
    catch (error) {
        console.error('Contact lists fetch error:', error);
        return res.status(500).json(response_utils_1.ResponseUtils.serverError('Failed to fetch contact lists', error));
    }
});
router.post('/', async (req, res) => {
    try {
        const user = req.user;
        const validatedData = validation_1.contactListSchema.parse(req.body);
        const { name, description, tags } = validatedData;
        const existingList = await connection_1.db.select()
            .from(schema_1.contactLists)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.contactLists.userId, user.id), (0, drizzle_orm_1.eq)(schema_1.contactLists.name, name), (0, drizzle_orm_1.eq)(schema_1.contactLists.isActive, true)))
            .limit(1);
        if (existingList.length > 0) {
            return res.status(400).json(response_utils_1.ResponseUtils.error('Contact list with this name already exists', 400));
        }
        const newContactList = {
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
        const createdLists = await connection_1.db.insert(schema_1.contactLists).values(newContactList).returning({
            id: schema_1.contactLists.id,
            name: schema_1.contactLists.name,
            description: schema_1.contactLists.description,
            totalContacts: schema_1.contactLists.totalContacts,
            validContacts: schema_1.contactLists.validContacts,
            invalidContacts: schema_1.contactLists.invalidContacts,
            riskyContacts: schema_1.contactLists.riskyContacts,
            unknownContacts: schema_1.contactLists.unknownContacts,
            tags: schema_1.contactLists.tags,
            isActive: schema_1.contactLists.isActive,
            createdAt: schema_1.contactLists.createdAt
        });
        const createdList = createdLists[0];
        if (!createdList) {
            throw new Error('Failed to create contact list');
        }
        return res.status(201).json(response_utils_1.ResponseUtils.success({
            message: 'Contact list created successfully',
            contactList: {
                ...createdList,
                tags: createdList.tags ? JSON.parse(createdList.tags) : []
            }
        }));
    }
    catch (error) {
        if (error instanceof zod_1.ZodError) {
            return res.status(400).json(response_utils_1.ResponseUtils.validationError(error.errors.map(e => e.message).join(', ')));
        }
        console.error('Contact list creation error:', error);
        return res.status(500).json(response_utils_1.ResponseUtils.serverError('Failed to create contact list', error));
    }
});
router.get('/:id', async (req, res) => {
    try {
        const user = req.user;
        const { id } = req.params;
        const listId = parseInt(id);
        if (isNaN(listId)) {
            return res.status(400).json(response_utils_1.ResponseUtils.validationError('Invalid contact list ID'));
        }
        const contactListRecords = await connection_1.db.select()
            .from(schema_1.contactLists)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.contactLists.id, listId), (0, drizzle_orm_1.eq)(schema_1.contactLists.userId, user.id), (0, drizzle_orm_1.eq)(schema_1.contactLists.isActive, true)))
            .limit(1);
        const contactList = contactListRecords[0];
        if (!contactList) {
            return res.status(404).json(response_utils_1.ResponseUtils.error('Contact list not found', 404));
        }
        return res.json(response_utils_1.ResponseUtils.success({
            contactList: {
                ...contactList,
                tags: contactList.tags ? JSON.parse(contactList.tags) : []
            }
        }));
    }
    catch (error) {
        console.error('Contact list fetch error:', error);
        return res.status(500).json(response_utils_1.ResponseUtils.serverError('Failed to fetch contact list', error));
    }
});
router.put('/:id', async (req, res) => {
    try {
        const user = req.user;
        const { id } = req.params;
        const { name, description, tags, isActive } = req.body;
        const listId = parseInt(id);
        if (isNaN(listId)) {
            return res.status(400).json(response_utils_1.ResponseUtils.validationError('Invalid contact list ID'));
        }
        const existingList = await connection_1.db.select()
            .from(schema_1.contactLists)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.contactLists.id, listId), (0, drizzle_orm_1.eq)(schema_1.contactLists.userId, user.id)))
            .limit(1);
        if (existingList.length === 0) {
            return res.status(404).json(response_utils_1.ResponseUtils.error('Contact list not found', 404));
        }
        const updates = {
            updatedAt: new Date().toISOString()
        };
        if (name !== undefined) {
            if (typeof name !== 'string' || name.trim().length === 0) {
                return res.status(400).json(response_utils_1.ResponseUtils.validationError('Name must be a non-empty string'));
            }
            const duplicateCheck = await connection_1.db.select()
                .from(schema_1.contactLists)
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.contactLists.userId, user.id), (0, drizzle_orm_1.eq)(schema_1.contactLists.name, name.trim()), (0, drizzle_orm_1.eq)(schema_1.contactLists.isActive, true)))
                .limit(1);
            if (duplicateCheck.length > 0 && duplicateCheck[0]?.id !== listId) {
                return res.status(400).json(response_utils_1.ResponseUtils.error('Contact list with this name already exists', 400));
            }
            updates.name = name.trim();
        }
        if (description !== undefined) {
            updates.description = typeof description === 'string' ? description.trim() || null : null;
        }
        if (tags !== undefined) {
            if (Array.isArray(tags)) {
                updates.tags = JSON.stringify(tags);
            }
            else {
                return res.status(400).json(response_utils_1.ResponseUtils.validationError('Tags must be an array'));
            }
        }
        if (isActive !== undefined) {
            if (typeof isActive !== 'boolean') {
                return res.status(400).json(response_utils_1.ResponseUtils.validationError('isActive must be a boolean'));
            }
            updates.isActive = isActive;
        }
        const updatedLists = await connection_1.db.update(schema_1.contactLists)
            .set(updates)
            .where((0, drizzle_orm_1.eq)(schema_1.contactLists.id, listId))
            .returning();
        const updatedList = updatedLists[0];
        if (!updatedList) {
            throw new Error('Failed to update contact list');
        }
        return res.json(response_utils_1.ResponseUtils.success({
            message: 'Contact list updated successfully',
            contactList: {
                ...updatedList,
                tags: updatedList.tags ? JSON.parse(updatedList.tags) : []
            }
        }));
    }
    catch (error) {
        console.error('Contact list update error:', error);
        return res.status(500).json(response_utils_1.ResponseUtils.serverError('Failed to update contact list', error));
    }
});
router.delete('/:id', async (req, res) => {
    try {
        const user = req.user;
        const { id } = req.params;
        const listId = parseInt(id);
        if (isNaN(listId)) {
            return res.status(400).json(response_utils_1.ResponseUtils.validationError('Invalid contact list ID'));
        }
        const deletedLists = await connection_1.db.update(schema_1.contactLists)
            .set({
            isActive: false,
            updatedAt: new Date().toISOString()
        })
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.contactLists.id, listId), (0, drizzle_orm_1.eq)(schema_1.contactLists.userId, user.id)))
            .returning({
            id: schema_1.contactLists.id,
            name: schema_1.contactLists.name
        });
        if (deletedLists.length === 0) {
            return res.status(404).json(response_utils_1.ResponseUtils.error('Contact list not found', 404));
        }
        await connection_1.db.update(schema_1.contacts)
            .set({ updatedAt: new Date().toISOString() })
            .where((0, drizzle_orm_1.eq)(schema_1.contacts.contactListId, listId));
        const deletedList = deletedLists[0];
        return res.json(response_utils_1.ResponseUtils.success({
            message: 'Contact list deleted successfully',
            deletedList: {
                id: deletedList.id,
                name: deletedList.name
            }
        }));
    }
    catch (error) {
        console.error('Contact list deletion error:', error);
        return res.status(500).json(response_utils_1.ResponseUtils.serverError('Failed to delete contact list', error));
    }
});
router.get('/:id/statistics', async (req, res) => {
    try {
        const user = req.user;
        const { id } = req.params;
        const listId = parseInt(id);
        if (isNaN(listId)) {
            return res.status(400).json(response_utils_1.ResponseUtils.validationError('Invalid contact list ID'));
        }
        const contactList = await connection_1.db.select()
            .from(schema_1.contactLists)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.contactLists.id, listId), (0, drizzle_orm_1.eq)(schema_1.contactLists.userId, user.id), (0, drizzle_orm_1.eq)(schema_1.contactLists.isActive, true)))
            .limit(1);
        if (contactList.length === 0) {
            return res.status(404).json(response_utils_1.ResponseUtils.error('Contact list not found', 404));
        }
        const list = contactList[0];
        const total = list.totalContacts || 0;
        const valid = list.validContacts || 0;
        const invalid = list.invalidContacts || 0;
        const risky = list.riskyContacts || 0;
        const unknown = list.unknownContacts || 0;
        return res.json(response_utils_1.ResponseUtils.success({
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
    }
    catch (error) {
        console.error('Contact list statistics error:', error);
        return res.status(500).json(response_utils_1.ResponseUtils.serverError('Failed to fetch statistics', error));
    }
});
//# sourceMappingURL=contact-lists.routes.js.map