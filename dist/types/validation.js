"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.bulkContactImportSchema = exports.contactListSchema = exports.contactSchema = exports.apiKeyCreationSchema = exports.userLoginSchema = exports.userRegistrationSchema = exports.batchEmailValidationSchema = exports.emailValidationSchema = void 0;
const zod_1 = require("zod");
exports.emailValidationSchema = zod_1.z.object({
    email: zod_1.z.string().email('Invalid email format').max(254, 'Email too long'),
});
exports.batchEmailValidationSchema = zod_1.z.object({
    emails: zod_1.z.array(zod_1.z.string().email('Invalid email format')).min(1, 'At least one email required').max(100, 'Maximum 100 emails per batch'),
});
exports.userRegistrationSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, 'Name is required').max(255, 'Name too long'),
    email: zod_1.z.string().email('Invalid email format').max(255, 'Email too long'),
    password: zod_1.z.string().min(8, 'Password must be at least 8 characters').max(128, 'Password too long'),
});
exports.userLoginSchema = zod_1.z.object({
    email: zod_1.z.string().email('Invalid email format'),
    password: zod_1.z.string().min(1, 'Password is required'),
});
exports.apiKeyCreationSchema = zod_1.z.object({
    keyName: zod_1.z.string().min(1, 'Key name is required').max(255, 'Key name too long'),
    rateLimit: zod_1.z.number().int().min(1).max(10000).optional(),
});
exports.contactSchema = zod_1.z.object({
    email: zod_1.z.string().email('Invalid email format'),
    firstName: zod_1.z.string().optional(),
    lastName: zod_1.z.string().optional(),
    phone: zod_1.z.string().optional(),
    company: zod_1.z.string().optional(),
    customFields: zod_1.z.record(zod_1.z.string()).optional(),
    tags: zod_1.z.array(zod_1.z.string()).optional(),
    notes: zod_1.z.string().optional(),
});
exports.contactListSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, 'List name is required').max(255, 'List name too long'),
    description: zod_1.z.string().optional(),
    tags: zod_1.z.array(zod_1.z.string()).optional(),
});
exports.bulkContactImportSchema = zod_1.z.object({
    contactListId: zod_1.z.number().int().positive(),
    contacts: zod_1.z.array(exports.contactSchema).min(1, 'At least one contact required').max(1000, 'Maximum 1000 contacts per import'),
});
//# sourceMappingURL=validation.js.map