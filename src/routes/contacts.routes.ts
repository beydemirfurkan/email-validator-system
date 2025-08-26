import { Router, Request, Response } from 'express';
import { eq, and, desc, count, inArray } from 'drizzle-orm';
import { db } from '../database/connection';
import { contacts, contactLists, NewContact } from '../database/schema';
import { AuthMiddleware } from '../middleware/auth.middleware';
import { ResponseUtils } from '../utils/response.utils';
import { contactSchema, bulkContactImportSchema } from '../types/validation';
import { EmailValidationService } from '../services/email-validation.service';
import { ZodError } from 'zod';

const router = Router();

// All contact routes require authentication
router.use(AuthMiddleware.authenticateToken);

// Helper function to verify contact list ownership
async function verifyContactListOwnership(listId: number, userId: number): Promise<boolean> {
  const contactList = await db.select()
    .from(contactLists)
    .where(and(
      eq(contactLists.id, listId),
      eq(contactLists.userId, userId),
      eq(contactLists.isActive, true)
    ))
    .limit(1);

  return contactList.length > 0;
}

// Helper function to update contact list statistics
async function updateContactListStatistics(listId: number): Promise<void> {
  const stats = await db.select({
    total: count(),
    // For SQLite, we need to handle the COUNT with conditions differently
  }).from(contacts).where(eq(contacts.contactListId, listId));

  const validCount = await db.select({ count: count() })
    .from(contacts)
    .where(and(
      eq(contacts.contactListId, listId),
      eq(contacts.validationStatus, 'valid')
    ));

  const invalidCount = await db.select({ count: count() })
    .from(contacts)
    .where(and(
      eq(contacts.contactListId, listId),
      eq(contacts.validationStatus, 'invalid')
    ));

  const riskyCount = await db.select({ count: count() })
    .from(contacts)
    .where(and(
      eq(contacts.contactListId, listId),
      eq(contacts.validationStatus, 'risky')
    ));

  const unknownCount = await db.select({ count: count() })
    .from(contacts)
    .where(and(
      eq(contacts.contactListId, listId),
      eq(contacts.validationStatus, 'unknown')
    ));

  await db.update(contactLists)
    .set({
      totalContacts: stats[0]?.total || 0,
      validContacts: validCount[0]?.count || 0,
      invalidContacts: invalidCount[0]?.count || 0,
      riskyContacts: riskyCount[0]?.count || 0,
      unknownContacts: unknownCount[0]?.count || 0,
      updatedAt: new Date()
    })
    .where(eq(contactLists.id, listId));
}

// GET /api/contact-lists/:listId/contacts - List contacts in a contact list
router.get('/lists/:listId/contacts', async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const { listId } = req.params;
    const { page = '1', limit = '50', status, search } = req.query;

    const listIdNum = parseInt(listId!);
    if (isNaN(listIdNum)) {
      return res.status(400).json(
        ResponseUtils.validationError('Invalid contact list ID')
      );
    }

    // Verify contact list ownership
    const hasAccess = await verifyContactListOwnership(listIdNum, user.id);
    if (!hasAccess) {
      return res.status(404).json(
        ResponseUtils.error('Contact list not found', 404)
      );
    }

    const pageNum = Math.max(1, parseInt(page as string) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string) || 50));
    const offset = (pageNum - 1) * limitNum;

    // Build base query
    let whereConditions = [eq(contacts.contactListId, listIdNum)];

    // Add status filter
    if (status && typeof status === 'string') {
      const validStatuses = ['pending', 'validating', 'valid', 'invalid', 'risky', 'unknown'];
      if (validStatuses.includes(status)) {
        whereConditions.push(eq(contacts.validationStatus, status as any));
      }
    }

    const contactsData = await db.select({
      id: contacts.id,
      email: contacts.email,
      firstName: contacts.firstName,
      lastName: contacts.lastName,
      phone: contacts.phone,
      company: contacts.company,
      customFields: contacts.customFields,
      validationStatus: contacts.validationStatus,
      validationScore: contacts.validationScore,
      lastValidatedAt: contacts.lastValidatedAt,
      tags: contacts.tags,
      notes: contacts.notes,
      isSubscribed: contacts.isSubscribed,
      bouncedAt: contacts.bouncedAt,
      unsubscribedAt: contacts.unsubscribedAt,
      createdAt: contacts.createdAt,
      updatedAt: contacts.updatedAt
    })
    .from(contacts)
    .where(and(...whereConditions))
    .orderBy(desc(contacts.createdAt))
    .limit(limitNum)
    .offset(offset);

    // Get total count
    const totalResult = await db.select({ count: count() })
      .from(contacts)
      .where(and(...whereConditions));

    const total = totalResult[0]?.count || 0;

    // Parse JSON fields
    const parsedContacts = contactsData.map(contact => ({
      ...contact,
      customFields: contact.customFields ? JSON.parse(contact.customFields as string) : {},
      tags: contact.tags ? JSON.parse(contact.tags as string) : []
    }));

    return res.json(ResponseUtils.createPaginatedResponse(
      parsedContacts,
      pageNum,
      limitNum,
      total
    ));
  } catch (error) {
    console.error('Contacts fetch error:', error);
    return res.status(500).json(
      ResponseUtils.serverError('Failed to fetch contacts', error as Error)
    );
  }
});

// POST /api/contact-lists/:listId/contacts - Add contact to list
router.post('/lists/:listId/contacts', async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const { listId } = req.params;
    const validatedData = contactSchema.parse(req.body);

    const listIdNum = parseInt(listId!);
    if (isNaN(listIdNum)) {
      return res.status(400).json(
        ResponseUtils.validationError('Invalid contact list ID')
      );
    }

    // Verify contact list ownership
    const hasAccess = await verifyContactListOwnership(listIdNum, user.id);
    if (!hasAccess) {
      return res.status(404).json(
        ResponseUtils.error('Contact list not found', 404)
      );
    }

    // Check if contact already exists in this list
    const existingContact = await db.select()
      .from(contacts)
      .where(and(
        eq(contacts.contactListId, listIdNum),
        eq(contacts.email, validatedData.email.toLowerCase())
      ))
      .limit(1);

    if (existingContact.length > 0) {
      return res.status(400).json(
        ResponseUtils.error('Contact with this email already exists in the list', 400)
      );
    }

    // Create new contact
    const newContact: NewContact = {
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

    const createdContacts = await db.insert(contacts).values(newContact).returning();
    const createdContact = createdContacts[0];

    if (!createdContact) {
      throw new Error('Failed to create contact');
    }

    // Update contact list statistics
    await updateContactListStatistics(listIdNum);

    return res.status(201).json(ResponseUtils.success({
      message: 'Contact added successfully',
      contact: {
        ...createdContact,
        customFields: createdContact.customFields ? JSON.parse(createdContact.customFields as string) : {},
        tags: createdContact.tags ? JSON.parse(createdContact.tags as string) : []
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

    console.error('Contact creation error:', error);
    return res.status(500).json(
      ResponseUtils.serverError('Failed to create contact', error as Error)
    );
  }
});

// GET /api/contacts/:id - Get specific contact details
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const { id } = req.params;

    const contactId = parseInt(id!);
    if (isNaN(contactId)) {
      return res.status(400).json(
        ResponseUtils.validationError('Invalid contact ID')
      );
    }

    // Get contact with contact list ownership verification
    const contactData = await db.select()
      .from(contacts)
      .innerJoin(contactLists, eq(contacts.contactListId, contactLists.id))
      .where(and(
        eq(contacts.id, contactId),
        eq(contactLists.userId, user.id),
        eq(contactLists.isActive, true)
      ))
      .limit(1);

    if (contactData.length === 0) {
      return res.status(404).json(
        ResponseUtils.error('Contact not found', 404)
      );
    }

    const contact = contactData[0]?.contacts;
    
    if (!contact) {
      return res.status(404).json(
        ResponseUtils.error('Contact not found', 404)
      );
    }

    return res.json(ResponseUtils.success({
      contact: {
        ...contact,
        customFields: contact.customFields ? JSON.parse(contact.customFields as string) : {},
        tags: contact.tags ? JSON.parse(contact.tags as string) : [],
        validationResult: contact.validationResult ? JSON.parse(contact.validationResult as string) : null
      }
    }));
  } catch (error) {
    console.error('Contact fetch error:', error);
    return res.status(500).json(
      ResponseUtils.serverError('Failed to fetch contact', error as Error)
    );
  }
});

// PUT /api/contacts/:id - Update contact
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const { id } = req.params;
    const { firstName, lastName, phone, company, customFields, tags, notes, isSubscribed } = req.body;

    const contactId = parseInt(id!);
    if (isNaN(contactId)) {
      return res.status(400).json(
        ResponseUtils.validationError('Invalid contact ID')
      );
    }

    // Verify contact ownership
    const contactData = await db.select({ contacts, contactLists })
      .from(contacts)
      .innerJoin(contactLists, eq(contacts.contactListId, contactLists.id))
      .where(and(
        eq(contacts.id, contactId),
        eq(contactLists.userId, user.id),
        eq(contactLists.isActive, true)
      ))
      .limit(1);

    if (contactData.length === 0) {
      return res.status(404).json(
        ResponseUtils.error('Contact not found', 404)
      );
    }

    // Build update object
    const updates: Partial<NewContact> = {
      updatedAt: new Date()
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
      } else {
        updates.customFields = null;
      }
    }

    if (tags !== undefined) {
      if (Array.isArray(tags)) {
        updates.tags = JSON.stringify(tags);
      } else {
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
          updates.unsubscribedAt = new Date();
        }
      }
    }

    // Update contact
    const updatedContacts = await db.update(contacts)
      .set(updates)
      .where(eq(contacts.id, contactId))
      .returning();

    const updatedContact = updatedContacts[0];
    if (!updatedContact) {
      throw new Error('Failed to update contact');
    }

    return res.json(ResponseUtils.success({
      message: 'Contact updated successfully',
      contact: {
        ...updatedContact,
        customFields: updatedContact.customFields ? JSON.parse(updatedContact.customFields as string) : {},
        tags: updatedContact.tags ? JSON.parse(updatedContact.tags as string) : []
      }
    }));
  } catch (error) {
    console.error('Contact update error:', error);
    return res.status(500).json(
      ResponseUtils.serverError('Failed to update contact', error as Error)
    );
  }
});

// DELETE /api/contacts/:id - Delete contact
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const { id } = req.params;

    const contactId = parseInt(id!);
    if (isNaN(contactId)) {
      return res.status(400).json(
        ResponseUtils.validationError('Invalid contact ID')
      );
    }

    // Get contact with ownership verification
    const contactData = await db.select({ contacts, contactLists })
      .from(contacts)
      .innerJoin(contactLists, eq(contacts.contactListId, contactLists.id))
      .where(and(
        eq(contacts.id, contactId),
        eq(contactLists.userId, user.id),
        eq(contactLists.isActive, true)
      ))
      .limit(1);

    if (contactData.length === 0) {
      return res.status(404).json(
        ResponseUtils.error('Contact not found', 404)
      );
    }

    const contact = contactData[0]!.contacts;
    const listId = contact.contactListId;

    // Delete contact
    await db.delete(contacts).where(eq(contacts.id, contactId));

    // Update contact list statistics
    await updateContactListStatistics(listId);

    return res.json(ResponseUtils.success({
      message: 'Contact deleted successfully',
      deletedContact: {
        id: contact.id,
        email: contact.email
      }
    }));
  } catch (error) {
    console.error('Contact deletion error:', error);
    return res.status(500).json(
      ResponseUtils.serverError('Failed to delete contact', error as Error)
    );
  }
});

// POST /api/contacts/bulk-import - Bulk import contacts
router.post('/bulk-import', async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const validatedData = bulkContactImportSchema.parse(req.body);
    const { contactListId, contacts: contactsToImport } = validatedData;

    // Verify contact list ownership
    const hasAccess = await verifyContactListOwnership(contactListId, user.id);
    if (!hasAccess) {
      return res.status(404).json(
        ResponseUtils.error('Contact list not found', 404)
      );
    }

    // Get existing emails to avoid duplicates
    const existingEmails = await db.select({ email: contacts.email })
      .from(contacts)
      .where(eq(contacts.contactListId, contactListId));

    const existingEmailsSet = new Set(existingEmails.map(e => e.email));

    // Filter out duplicates
    const newContacts = contactsToImport.filter(contact => 
      !existingEmailsSet.has(contact.email.toLowerCase())
    );

    if (newContacts.length === 0) {
      return res.status(400).json(
        ResponseUtils.error('All contacts already exist in the list', 400)
      );
    }

    // Prepare contacts for insertion
    const contactsToInsert: NewContact[] = newContacts.map(contact => ({
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

    // Insert contacts in batches
    const batchSize = 100;
    const insertedContacts = [];

    for (let i = 0; i < contactsToInsert.length; i += batchSize) {
      const batch = contactsToInsert.slice(i, i + batchSize);
      const result = await db.insert(contacts).values(batch).returning({
        id: contacts.id,
        email: contacts.email
      });
      insertedContacts.push(...result);
    }

    // Update contact list statistics
    await updateContactListStatistics(contactListId);

    return res.status(201).json(ResponseUtils.success({
      message: 'Contacts imported successfully',
      summary: {
        totalSubmitted: contactsToImport.length,
        imported: insertedContacts.length,
        duplicatesSkipped: contactsToImport.length - insertedContacts.length,
        importedContacts: insertedContacts
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

    console.error('Bulk import error:', error);
    return res.status(500).json(
      ResponseUtils.serverError('Failed to import contacts', error as Error)
    );
  }
});

// POST /api/contacts/:id/validate - Validate specific contact
router.post('/:id/validate', async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const { id } = req.params;

    const contactId = parseInt(id!);
    if (isNaN(contactId)) {
      return res.status(400).json(
        ResponseUtils.validationError('Invalid contact ID')
      );
    }

    // Get contact with ownership verification
    const contactData = await db.select({ contacts, contactLists })
      .from(contacts)
      .innerJoin(contactLists, eq(contacts.contactListId, contactLists.id))
      .where(and(
        eq(contacts.id, contactId),
        eq(contactLists.userId, user.id),
        eq(contactLists.isActive, true)
      ))
      .limit(1);

    if (contactData.length === 0) {
      return res.status(404).json(
        ResponseUtils.error('Contact not found', 404)
      );
    }

    const contact = contactData[0]!.contacts;

    // Validate email
    const emailValidator = new EmailValidationService();
    const validationResult = await emailValidator.validateSingle(contact.email);

    // Determine validation status
    let validationStatus: 'valid' | 'invalid' | 'risky' = 'invalid';
    if (validationResult.valid) {
      validationStatus = validationResult.score >= 80 ? 'valid' : 'risky';
    }

    // Update contact with validation results
    const updatedContacts = await db.update(contacts)
      .set({
        validationStatus,
        validationResult: JSON.stringify(validationResult),
        validationScore: validationResult.score,
        lastValidatedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(contacts.id, contactId))
      .returning();

    // Update contact list statistics
    await updateContactListStatistics(contact.contactListId);

    const updatedContact = updatedContacts[0];

    return res.json(ResponseUtils.success({
      message: 'Contact validated successfully',
      contact: {
        id: updatedContact!.id,
        email: updatedContact!.email,
        validationStatus: updatedContact!.validationStatus,
        validationScore: updatedContact!.validationScore,
        lastValidatedAt: updatedContact!.lastValidatedAt
      },
      validationResult
    }));
  } catch (error) {
    console.error('Contact validation error:', error);
    return res.status(500).json(
      ResponseUtils.serverError('Failed to validate contact', error as Error)
    );
  }
});

export { router as contactsRoutes };