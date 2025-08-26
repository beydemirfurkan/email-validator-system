import request from 'supertest';
import app from '../src/app';
import { db } from '../src/database/connection';
import { users, apiKeys, contactLists, contacts } from '../src/database/schema';
import { eq } from 'drizzle-orm';

describe('Contact Management API Tests', () => {
  let userToken: string;
  let userId: number;
  let contactListId: number;

  beforeAll(async () => {
    // Clean database
    await db.delete(contacts);
    await db.delete(contactLists);
    await db.delete(apiKeys);
    await db.delete(users);

    // Register test user
    const registerResponse = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Test User',
        email: 'test@example.com',
        password: 'TestPassword123!'
      });

    userToken = registerResponse.body.data.token;
    userId = registerResponse.body.data.user.id;

    // Create contact list
    const contactListResponse = await request(app)
      .post('/api/contact-lists')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        name: 'Test Contact List',
        description: 'Test description'
      });

    contactListId = contactListResponse.body.data.contactList.id;
  });

  describe('POST /api/contacts/lists/:listId/contacts', () => {
    it('should add contact to list successfully', async () => {
      const contactData = {
        email: 'contact1@example.com',
        firstName: 'John',
        lastName: 'Doe',
        company: 'Test Corp',
        customFields: { department: 'Marketing' },
        tags: ['lead', 'important']
      };

      const response = await request(app)
        .post(`/api/contacts/lists/${contactListId}/contacts`)
        .set('Authorization', `Bearer ${userToken}`)
        .send(contactData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.contact.email).toBe(contactData.email);
      expect(response.body.data.contact.firstName).toBe(contactData.firstName);
      expect(response.body.data.contact.validationStatus).toBe('pending');
    });

    it('should fail to add duplicate email to same list', async () => {
      const contactData = {
        email: 'duplicate@example.com',
        firstName: 'First',
        lastName: 'Contact'
      };

      // Add first contact
      await request(app)
        .post(`/api/contacts/lists/${contactListId}/contacts`)
        .set('Authorization', `Bearer ${userToken}`)
        .send(contactData)
        .expect(201);

      // Try to add duplicate
      const response = await request(app)
        .post(`/api/contacts/lists/${contactListId}/contacts`)
        .set('Authorization', `Bearer ${userToken}`)
        .send(contactData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('already exists');
    });

    it('should fail to add contact to non-existent list', async () => {
      const response = await request(app)
        .post('/api/contacts/lists/99999/contacts')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          email: 'test@example.com'
        })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('not found');
    });
  });

  describe('GET /api/contacts/lists/:listId/contacts', () => {
    beforeAll(async () => {
      // Add multiple contacts for testing
      const testContacts = [
        { email: 'contact2@example.com', firstName: 'Alice', validationStatus: 'valid' },
        { email: 'contact3@example.com', firstName: 'Bob', validationStatus: 'invalid' },
        { email: 'contact4@example.com', firstName: 'Charlie', validationStatus: 'risky' }
      ];

      for (const contact of testContacts) {
        await request(app)
          .post(`/api/contacts/lists/${contactListId}/contacts`)
          .set('Authorization', `Bearer ${userToken}`)
          .send(contact);

        if (contact.validationStatus !== 'pending') {
          // Update validation status directly in database for testing
          await db.update(contacts)
            .set({ validationStatus: contact.validationStatus } as any)
            .where(eq(contacts.email, contact.email));
        }
      }
    });

    it('should list contacts in a contact list', async () => {
      const response = await request(app)
        .get(`/api/contacts/lists/${contactListId}/contacts`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.meta.total).toBeGreaterThan(0);
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get(`/api/contacts/lists/${contactListId}/contacts?page=1&limit=2`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBeLessThanOrEqual(2);
      expect(response.body.meta.page).toBe(1);
      expect(response.body.meta.limit).toBe(2);
    });

    it('should filter by validation status', async () => {
      const response = await request(app)
        .get(`/api/contacts/lists/${contactListId}/contacts?status=pending`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      // All returned contacts should have pending status
      response.body.data.forEach(contact => {
        expect(contact.validationStatus).toBe('pending');
      });
    });
  });

  describe('POST /api/contacts/bulk-import', () => {
    it('should import multiple contacts successfully', async () => {
      const bulkContacts = [
        { email: 'bulk1@example.com', firstName: 'Bulk', lastName: 'User1' },
        { email: 'bulk2@example.com', firstName: 'Bulk', lastName: 'User2' },
        { email: 'bulk3@example.com', firstName: 'Bulk', lastName: 'User3' }
      ];

      const response = await request(app)
        .post('/api/contacts/bulk-import')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          contactListId,
          contacts: bulkContacts
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.summary.imported).toBe(3);
      expect(response.body.data.summary.duplicatesSkipped).toBe(0);
    });

    it('should skip duplicate emails during bulk import', async () => {
      const bulkContacts = [
        { email: 'existing@example.com', firstName: 'New', lastName: 'User' },
        { email: 'bulk1@example.com', firstName: 'Duplicate', lastName: 'User' } // This already exists
      ];

      // First add one contact
      await request(app)
        .post(`/api/contacts/lists/${contactListId}/contacts`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ email: 'existing@example.com', firstName: 'Existing' });

      const response = await request(app)
        .post('/api/contacts/bulk-import')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          contactListId,
          contacts: bulkContacts
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.summary.duplicatesSkipped).toBeGreaterThan(0);
    });
  });

  describe('PUT /api/contacts/:id', () => {
    let contactId: number;

    beforeAll(async () => {
      const response = await request(app)
        .post(`/api/contacts/lists/${contactListId}/contacts`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          email: 'update@example.com',
          firstName: 'Update',
          lastName: 'Test'
        });

      contactId = response.body.data.contact.id;
    });

    it('should update contact successfully', async () => {
      const updateData = {
        firstName: 'Updated',
        lastName: 'Name',
        company: 'New Company',
        customFields: { role: 'Manager' }
      };

      const response = await request(app)
        .put(`/api/contacts/${contactId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.contact.firstName).toBe(updateData.firstName);
      expect(response.body.data.contact.company).toBe(updateData.company);
    });

    it('should fail to update non-existent contact', async () => {
      const response = await request(app)
        .put('/api/contacts/99999')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          firstName: 'Updated'
        })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('not found');
    });
  });

  describe('DELETE /api/contacts/:id', () => {
    let contactId: number;

    beforeAll(async () => {
      const response = await request(app)
        .post(`/api/contacts/lists/${contactListId}/contacts`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          email: 'delete@example.com',
          firstName: 'Delete',
          lastName: 'Test'
        });

      contactId = response.body.data.contact.id;
    });

    it('should delete contact successfully', async () => {
      const response = await request(app)
        .delete(`/api/contacts/${contactId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.deletedContact.id).toBe(contactId);
    });

    it('should fail to delete non-existent contact', async () => {
      const response = await request(app)
        .delete('/api/contacts/99999')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('not found');
    });
  });

  describe('POST /api/contacts/:id/validate', () => {
    let contactId: number;

    beforeAll(async () => {
      const response = await request(app)
        .post(`/api/contacts/lists/${contactListId}/contacts`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          email: 'validate@gmail.com',
          firstName: 'Validate',
          lastName: 'Test'
        });

      contactId = response.body.data.contact.id;
    });

    it('should validate contact email successfully', async () => {
      const response = await request(app)
        .post(`/api/contacts/${contactId}/validate`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.contact.validationStatus).toBeDefined();
      expect(response.body.data.contact.validationScore).toBeDefined();
      expect(response.body.data.validationResult).toBeDefined();
    });
  });

  describe('Concurrent Contact Operations Test', () => {
    it('should handle multiple concurrent contact additions', async () => {
      const concurrentContacts = Array.from({ length: 10 }, (_, i) => ({
        email: `concurrent${i}@example.com`,
        firstName: `User${i}`,
        lastName: 'Concurrent'
      }));

      const promises = concurrentContacts.map(contact =>
        request(app)
          .post(`/api/contacts/lists/${contactListId}/contacts`)
          .set('Authorization', `Bearer ${userToken}`)
          .send(contact)
      );

      const responses = await Promise.all(promises);

      // All should succeed
      responses.forEach((response, index) => {
        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
        expect(response.body.data.contact.email).toBe(concurrentContacts[index].email);
      });
    });

    it('should handle concurrent contact list operations', async () => {
      const concurrentOperations = [
        request(app).get(`/api/contacts/lists/${contactListId}/contacts`).set('Authorization', `Bearer ${userToken}`),
        request(app).get(`/api/contact-lists/${contactListId}/statistics`).set('Authorization', `Bearer ${userToken}`),
        request(app).post(`/api/contacts/lists/${contactListId}/contacts`).set('Authorization', `Bearer ${userToken}`).send({ email: 'concurrent@example.com' }),
        request(app).get(`/api/contacts/lists/${contactListId}/contacts?page=1&limit=5`).set('Authorization', `Bearer ${userToken}`)
      ];

      const responses = await Promise.all(concurrentOperations);

      // All should succeed or handle gracefully
      responses.forEach(response => {
        expect([200, 201, 400, 404]).toContain(response.status);
      });
    });
  });

  describe('Database Transaction Test', () => {
    it('should maintain data consistency during bulk operations', async () => {
      const bulkContacts = Array.from({ length: 50 }, (_, i) => ({
        email: `transaction${i}@example.com`,
        firstName: `Transaction${i}`
      }));

      const response = await request(app)
        .post('/api/contacts/bulk-import')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          contactListId,
          contacts: bulkContacts
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.summary.imported).toBe(50);

      // Verify all contacts were actually created
      const listResponse = await request(app)
        .get(`/api/contacts/lists/${contactListId}/contacts`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(listResponse.body.meta.total).toBeGreaterThanOrEqual(50);
    });
  });
});