"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.contactsRoutes = void 0;
const express_1 = require("express");
const drizzle_orm_1 = require("drizzle-orm");
const connection_1 = require("../database/connection");
const schema_1 = require("../database/schema");
const auth_middleware_1 = require("../middleware/auth.middleware");
const response_utils_1 = require("../utils/response.utils");
const validation_1 = require("../types/validation");
const email_validation_service_1 = require("../services/email-validation.service");
const zod_1 = require("zod");
const router = (0, express_1.Router)();
exports.contactsRoutes = router;
router.use(auth_middleware_1.AuthMiddleware.authenticateToken);
async function verifyContactListOwnership(listId, userId) {
    const contactList = await connection_1.db.select()
        .from(schema_1.contactLists)
        .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.contactLists.id, listId), (0, drizzle_orm_1.eq)(schema_1.contactLists.userId, userId), (0, drizzle_orm_1.eq)(schema_1.contactLists.isActive, true)))
        .limit(1);
    return contactList.length > 0;
}
async function updateContactListStatistics(listId) {
    const stats = await connection_1.db.select({
        total: (0, drizzle_orm_1.count)(),
    }).from(schema_1.contacts).where((0, drizzle_orm_1.eq)(schema_1.contacts.contactListId, listId));
    const validCount = await connection_1.db.select({ count: (0, drizzle_orm_1.count)() })
        .from(schema_1.contacts)
        .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.contacts.contactListId, listId), (0, drizzle_orm_1.eq)(schema_1.contacts.validationStatus, 'valid')));
    const invalidCount = await connection_1.db.select({ count: (0, drizzle_orm_1.count)() })
        .from(schema_1.contacts)
        .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.contacts.contactListId, listId), (0, drizzle_orm_1.eq)(schema_1.contacts.validationStatus, 'invalid')));
    const riskyCount = await connection_1.db.select({ count: (0, drizzle_orm_1.count)() })
        .from(schema_1.contacts)
        .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.contacts.contactListId, listId), (0, drizzle_orm_1.eq)(schema_1.contacts.validationStatus, 'risky')));
    const unknownCount = await connection_1.db.select({ count: (0, drizzle_orm_1.count)() })
        .from(schema_1.contacts)
        .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.contacts.contactListId, listId), (0, drizzle_orm_1.eq)(schema_1.contacts.validationStatus, 'unknown')));
    await connection_1.db.update(schema_1.contactLists)
        .set({
        totalContacts: stats[0]?.total || 0,
        validContacts: validCount[0]?.count || 0,
        invalidContacts: invalidCount[0]?.count || 0,
        riskyContacts: riskyCount[0]?.count || 0,
        unknownContacts: unknownCount[0]?.count || 0,
        updatedAt: new Date().toISOString()
    })
        .where((0, drizzle_orm_1.eq)(schema_1.contactLists.id, listId));
}
router.get('/lists/:listId/contacts', async (req, res) => {
    try {
        const user = req.user;
        const { listId } = req.params;
        const { page = '1', limit = '50', status, search } = req.query;
        const listIdNum = parseInt(listId);
        if (isNaN(listIdNum)) {
            return res.status(400).json(response_utils_1.ResponseUtils.validationError('Invalid contact list ID'));
        }
        const hasAccess = await verifyContactListOwnership(listIdNum, user.id);
        if (!hasAccess) {
            return res.status(404).json(response_utils_1.ResponseUtils.error('Contact list not found', 404));
        }
        const pageNum = Math.max(1, parseInt(page) || 1);
        const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 50));
        const offset = (pageNum - 1) * limitNum;
        let whereConditions = [(0, drizzle_orm_1.eq)(schema_1.contacts.contactListId, listIdNum)];
        if (status && typeof status === 'string') {
            const validStatuses = ['pending', 'validating', 'valid', 'invalid', 'risky', 'unknown'];
            if (validStatuses.includes(status)) {
                whereConditions.push((0, drizzle_orm_1.eq)(schema_1.contacts.validationStatus, status));
            }
        }
        const contactsData = await connection_1.db.select({
            id: schema_1.contacts.id,
            email: schema_1.contacts.email,
            firstName: schema_1.contacts.firstName,
            lastName: schema_1.contacts.lastName,
            phone: schema_1.contacts.phone,
            company: schema_1.contacts.company,
            customFields: schema_1.contacts.customFields,
            validationStatus: schema_1.contacts.validationStatus,
            validationScore: schema_1.contacts.validationScore,
            lastValidatedAt: schema_1.contacts.lastValidatedAt,
            tags: schema_1.contacts.tags,
            notes: schema_1.contacts.notes,
            isSubscribed: schema_1.contacts.isSubscribed,
            bouncedAt: schema_1.contacts.bouncedAt,
            unsubscribedAt: schema_1.contacts.unsubscribedAt,
            createdAt: schema_1.contacts.createdAt,
            updatedAt: schema_1.contacts.updatedAt
        })
            .from(schema_1.contacts)
            .where((0, drizzle_orm_1.and)(...whereConditions))
            .orderBy((0, drizzle_orm_1.desc)(schema_1.contacts.createdAt))
            .limit(limitNum)
            .offset(offset);
        const totalResult = await connection_1.db.select({ count: (0, drizzle_orm_1.count)() })
            .from(schema_1.contacts)
            .where((0, drizzle_orm_1.and)(...whereConditions));
        const total = totalResult[0]?.count || 0;
        const parsedContacts = contactsData.map(contact => ({
            ...contact,
            customFields: contact.customFields ? JSON.parse(contact.customFields) : {},
            tags: contact.tags ? JSON.parse(contact.tags) : []
        }));
        return res.json(response_utils_1.ResponseUtils.createPaginatedResponse(parsedContacts, pageNum, limitNum, total));
    }
    catch (error) {
        console.error('Contacts fetch error:', error);
        return res.status(500).json(response_utils_1.ResponseUtils.serverError('Failed to fetch contacts', error));
    }
});
router.post('/lists/:listId/contacts', async (req, res) => {
    try {
        const user = req.user;
        const { listId } = req.params;
        const validatedData = validation_1.contactSchema.parse(req.body);
        const listIdNum = parseInt(listId);
        if (isNaN(listIdNum)) {
            return res.status(400).json(response_utils_1.ResponseUtils.validationError('Invalid contact list ID'));
        }
        const hasAccess = await verifyContactListOwnership(listIdNum, user.id);
        if (!hasAccess) {
            return res.status(404).json(response_utils_1.ResponseUtils.error('Contact list not found', 404));
        }
        const existingContact = await connection_1.db.select()
            .from(schema_1.contacts)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.contacts.contactListId, listIdNum), (0, drizzle_orm_1.eq)(schema_1.contacts.email, validatedData.email.toLowerCase())))
            .limit(1);
        if (existingContact.length > 0) {
            return res.status(400).json(response_utils_1.ResponseUtils.error('Contact with this email already exists in the list', 400));
        }
        const newContact = {
            contactListId: listIdNum,
            email: validatedData.email.toLowerCase(),
            firstName: validatedData.firstName || null,
            lastName: validatedData.lastName || null,
            phone: validatedData.phone || null,
            company: validatedData.company || null,
            customFields: validatedData.customFields ? JSON.stringify(validatedData.customFields) : null,
            tags: validatedData.tags ? JSON.stringify(validatedData.tags) : null,
            notes: validatedData.notes || null,
            validationStatus: 'pending',
            isSubscribed: true
        };
        const createdContacts = await connection_1.db.insert(schema_1.contacts).values(newContact).returning();
        const createdContact = createdContacts[0];
        if (!createdContact) {
            throw new Error('Failed to create contact');
        }
        await updateContactListStatistics(listIdNum);
        return res.status(201).json(response_utils_1.ResponseUtils.success({
            message: 'Contact added successfully',
            contact: {
                ...createdContact,
                customFields: createdContact.customFields ? JSON.parse(createdContact.customFields) : {},
                tags: createdContact.tags ? JSON.parse(createdContact.tags) : []
            }
        }));
    }
    catch (error) {
        if (error instanceof zod_1.ZodError) {
            return res.status(400).json(response_utils_1.ResponseUtils.validationError(error.errors.map(e => e.message).join(', ')));
        }
        console.error('Contact creation error:', error);
        return res.status(500).json(response_utils_1.ResponseUtils.serverError('Failed to create contact', error));
    }
});
router.get('/:id', async (req, res) => {
    try {
        const user = req.user;
        const { id } = req.params;
        const contactId = parseInt(id);
        if (isNaN(contactId)) {
            return res.status(400).json(response_utils_1.ResponseUtils.validationError('Invalid contact ID'));
        }
        const contactData = await connection_1.db.select()
            .from(schema_1.contacts)
            .innerJoin(schema_1.contactLists, (0, drizzle_orm_1.eq)(schema_1.contacts.contactListId, schema_1.contactLists.id))
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.contacts.id, contactId), (0, drizzle_orm_1.eq)(schema_1.contactLists.userId, user.id), (0, drizzle_orm_1.eq)(schema_1.contactLists.isActive, true)))
            .limit(1);
        if (contactData.length === 0) {
            return res.status(404).json(response_utils_1.ResponseUtils.error('Contact not found', 404));
        }
        const contact = contactData[0]?.contacts;
        if (!contact) {
            return res.status(404).json(response_utils_1.ResponseUtils.error('Contact not found', 404));
        }
        return res.json(response_utils_1.ResponseUtils.success({
            contact: {
                ...contact,
                customFields: contact.customFields ? JSON.parse(contact.customFields) : {},
                tags: contact.tags ? JSON.parse(contact.tags) : [],
                validationResult: contact.validationResult ? JSON.parse(contact.validationResult) : null
            }
        }));
    }
    catch (error) {
        console.error('Contact fetch error:', error);
        return res.status(500).json(response_utils_1.ResponseUtils.serverError('Failed to fetch contact', error));
    }
});
router.put('/:id', async (req, res) => {
    try {
        const user = req.user;
        const { id } = req.params;
        const { firstName, lastName, phone, company, customFields, tags, notes, isSubscribed } = req.body;
        const contactId = parseInt(id);
        if (isNaN(contactId)) {
            return res.status(400).json(response_utils_1.ResponseUtils.validationError('Invalid contact ID'));
        }
        const contactData = await connection_1.db.select({ contacts: schema_1.contacts, contactLists: schema_1.contactLists })
            .from(schema_1.contacts)
            .innerJoin(schema_1.contactLists, (0, drizzle_orm_1.eq)(schema_1.contacts.contactListId, schema_1.contactLists.id))
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.contacts.id, contactId), (0, drizzle_orm_1.eq)(schema_1.contactLists.userId, user.id), (0, drizzle_orm_1.eq)(schema_1.contactLists.isActive, true)))
            .limit(1);
        if (contactData.length === 0) {
            return res.status(404).json(response_utils_1.ResponseUtils.error('Contact not found', 404));
        }
        const updates = {
            updatedAt: new Date().toISOString()
        };
        if (firstName !== undefined) {
            updates.firstName = typeof firstName === 'string' ? firstName.trim() || null : null;
        }
        if (lastName !== undefined) {
            updates.lastName = typeof lastName === 'string' ? lastName.trim() || null : null;
        }
        if (phone !== undefined) {
            updates.phone = typeof phone === 'string' ? phone.trim() || null : null;
        }
        if (company !== undefined) {
            updates.company = typeof company === 'string' ? company.trim() || null : null;
        }
        if (customFields !== undefined) {
            if (typeof customFields === 'object' && customFields !== null) {
                updates.customFields = JSON.stringify(customFields);
            }
            else {
                updates.customFields = null;
            }
        }
        if (tags !== undefined) {
            if (Array.isArray(tags)) {
                updates.tags = JSON.stringify(tags);
            }
            else {
                updates.tags = null;
            }
        }
        if (notes !== undefined) {
            updates.notes = typeof notes === 'string' ? notes.trim() || null : null;
        }
        if (isSubscribed !== undefined) {
            if (typeof isSubscribed === 'boolean') {
                updates.isSubscribed = isSubscribed;
                if (!isSubscribed) {
                    updates.unsubscribedAt = new Date().toISOString();
                }
            }
        }
        const updatedContacts = await connection_1.db.update(schema_1.contacts)
            .set(updates)
            .where((0, drizzle_orm_1.eq)(schema_1.contacts.id, contactId))
            .returning();
        const updatedContact = updatedContacts[0];
        if (!updatedContact) {
            throw new Error('Failed to update contact');
        }
        return res.json(response_utils_1.ResponseUtils.success({
            message: 'Contact updated successfully',
            contact: {
                ...updatedContact,
                customFields: updatedContact.customFields ? JSON.parse(updatedContact.customFields) : {},
                tags: updatedContact.tags ? JSON.parse(updatedContact.tags) : []
            }
        }));
    }
    catch (error) {
        console.error('Contact update error:', error);
        return res.status(500).json(response_utils_1.ResponseUtils.serverError('Failed to update contact', error));
    }
});
router.delete('/:id', async (req, res) => {
    try {
        const user = req.user;
        const { id } = req.params;
        const contactId = parseInt(id);
        if (isNaN(contactId)) {
            return res.status(400).json(response_utils_1.ResponseUtils.validationError('Invalid contact ID'));
        }
        const contactData = await connection_1.db.select({ contacts: schema_1.contacts, contactLists: schema_1.contactLists })
            .from(schema_1.contacts)
            .innerJoin(schema_1.contactLists, (0, drizzle_orm_1.eq)(schema_1.contacts.contactListId, schema_1.contactLists.id))
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.contacts.id, contactId), (0, drizzle_orm_1.eq)(schema_1.contactLists.userId, user.id), (0, drizzle_orm_1.eq)(schema_1.contactLists.isActive, true)))
            .limit(1);
        if (contactData.length === 0) {
            return res.status(404).json(response_utils_1.ResponseUtils.error('Contact not found', 404));
        }
        const contact = contactData[0].contacts;
        const listId = contact.contactListId;
        await connection_1.db.delete(schema_1.contacts).where((0, drizzle_orm_1.eq)(schema_1.contacts.id, contactId));
        await updateContactListStatistics(listId);
        return res.json(response_utils_1.ResponseUtils.success({
            message: 'Contact deleted successfully',
            deletedContact: {
                id: contact.id,
                email: contact.email
            }
        }));
    }
    catch (error) {
        console.error('Contact deletion error:', error);
        return res.status(500).json(response_utils_1.ResponseUtils.serverError('Failed to delete contact', error));
    }
});
router.post('/bulk-import', async (req, res) => {
    try {
        const user = req.user;
        const validatedData = validation_1.bulkContactImportSchema.parse(req.body);
        const { contactListId, contacts: contactsToImport } = validatedData;
        const hasAccess = await verifyContactListOwnership(contactListId, user.id);
        if (!hasAccess) {
            return res.status(404).json(response_utils_1.ResponseUtils.error('Contact list not found', 404));
        }
        const existingEmails = await connection_1.db.select({ email: schema_1.contacts.email })
            .from(schema_1.contacts)
            .where((0, drizzle_orm_1.eq)(schema_1.contacts.contactListId, contactListId));
        const existingEmailsSet = new Set(existingEmails.map(e => e.email));
        const newContacts = contactsToImport.filter(contact => !existingEmailsSet.has(contact.email.toLowerCase()));
        if (newContacts.length === 0) {
            return res.status(400).json(response_utils_1.ResponseUtils.error('All contacts already exist in the list', 400));
        }
        const contactsToInsert = newContacts.map(contact => ({
            contactListId,
            email: contact.email.toLowerCase(),
            firstName: contact.firstName || null,
            lastName: contact.lastName || null,
            phone: contact.phone || null,
            company: contact.company || null,
            customFields: contact.customFields ? JSON.stringify(contact.customFields) : null,
            tags: contact.tags ? JSON.stringify(contact.tags) : null,
            notes: contact.notes || null,
            validationStatus: 'pending',
            isSubscribed: true
        }));
        const batchSize = 100;
        const insertedContacts = [];
        for (let i = 0; i < contactsToInsert.length; i += batchSize) {
            const batch = contactsToInsert.slice(i, i + batchSize);
            const result = await connection_1.db.insert(schema_1.contacts).values(batch).returning({
                id: schema_1.contacts.id,
                email: schema_1.contacts.email
            });
            insertedContacts.push(...result);
        }
        await updateContactListStatistics(contactListId);
        return res.status(201).json(response_utils_1.ResponseUtils.success({
            message: 'Contacts imported successfully',
            summary: {
                totalSubmitted: contactsToImport.length,
                imported: insertedContacts.length,
                duplicatesSkipped: contactsToImport.length - insertedContacts.length,
                importedContacts: insertedContacts
            }
        }));
    }
    catch (error) {
        if (error instanceof zod_1.ZodError) {
            return res.status(400).json(response_utils_1.ResponseUtils.validationError(error.errors.map(e => e.message).join(', ')));
        }
        console.error('Bulk import error:', error);
        return res.status(500).json(response_utils_1.ResponseUtils.serverError('Failed to import contacts', error));
    }
});
router.post('/:id/validate', async (req, res) => {
    try {
        const user = req.user;
        const { id } = req.params;
        const contactId = parseInt(id);
        if (isNaN(contactId)) {
            return res.status(400).json(response_utils_1.ResponseUtils.validationError('Invalid contact ID'));
        }
        const contactData = await connection_1.db.select({ contacts: schema_1.contacts, contactLists: schema_1.contactLists })
            .from(schema_1.contacts)
            .innerJoin(schema_1.contactLists, (0, drizzle_orm_1.eq)(schema_1.contacts.contactListId, schema_1.contactLists.id))
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.contacts.id, contactId), (0, drizzle_orm_1.eq)(schema_1.contactLists.userId, user.id), (0, drizzle_orm_1.eq)(schema_1.contactLists.isActive, true)))
            .limit(1);
        if (contactData.length === 0) {
            return res.status(404).json(response_utils_1.ResponseUtils.error('Contact not found', 404));
        }
        const contact = contactData[0].contacts;
        const emailValidator = new email_validation_service_1.EmailValidationService();
        const validationResult = await emailValidator.validateSingle(contact.email);
        let validationStatus = 'invalid';
        if (validationResult.valid) {
            validationStatus = validationResult.score >= 80 ? 'valid' : 'risky';
        }
        const updatedContacts = await connection_1.db.update(schema_1.contacts)
            .set({
            validationStatus,
            validationResult: JSON.stringify(validationResult),
            validationScore: validationResult.score,
            lastValidatedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        })
            .where((0, drizzle_orm_1.eq)(schema_1.contacts.id, contactId))
            .returning();
        await updateContactListStatistics(contact.contactListId);
        const updatedContact = updatedContacts[0];
        return res.json(response_utils_1.ResponseUtils.success({
            message: 'Contact validated successfully',
            contact: {
                id: updatedContact.id,
                email: updatedContact.email,
                validationStatus: updatedContact.validationStatus,
                validationScore: updatedContact.validationScore,
                lastValidatedAt: updatedContact.lastValidatedAt
            },
            validationResult
        }));
    }
    catch (error) {
        console.error('Contact validation error:', error);
        return res.status(500).json(response_utils_1.ResponseUtils.serverError('Failed to validate contact', error));
    }
});
//# sourceMappingURL=contacts.routes.js.map