import { z } from 'zod';

export const emailValidationSchema = z.object({
  email: z.string().email('Invalid email format').max(254, 'Email too long'),
});

export const batchEmailValidationSchema = z.object({
  emails: z.array(z.string().email('Invalid email format')).min(1, 'At least one email required').max(100, 'Maximum 100 emails per batch'),
});

export const userRegistrationSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255, 'Name too long'),
  email: z.string().email('Invalid email format').max(255, 'Email too long'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128, 'Password too long'),
});

export const userLoginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

export const apiKeyCreationSchema = z.object({
  keyName: z.string().min(1, 'Key name is required').max(255, 'Key name too long'),
  rateLimit: z.number().int().min(1).max(10000).optional(),
  expiryDays: z.number().int().min(1).max(365).optional(),
});

export const contactSchema = z.object({
  email: z.string().email('Invalid email format'),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  phone: z.string().optional(),
  company: z.string().optional(),
  customFields: z.record(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  notes: z.string().optional(),
});

export const contactListSchema = z.object({
  name: z.string().min(1, 'List name is required').max(255, 'List name too long'),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

export const bulkContactImportSchema = z.object({
  contactListId: z.number().int().positive(),
  contacts: z.array(contactSchema).min(1, 'At least one contact required').max(1000, 'Maximum 1000 contacts per import'),
});

export type EmailValidationRequest = z.infer<typeof emailValidationSchema>;
export type BatchEmailValidationRequest = z.infer<typeof batchEmailValidationSchema>;
export type UserRegistrationRequest = z.infer<typeof userRegistrationSchema>;
export type UserLoginRequest = z.infer<typeof userLoginSchema>;
export type ApiKeyCreationRequest = z.infer<typeof apiKeyCreationSchema>;
export type ContactRequest = z.infer<typeof contactSchema>;
export type ContactListRequest = z.infer<typeof contactListSchema>;
export type BulkContactImportRequest = z.infer<typeof bulkContactImportSchema>;