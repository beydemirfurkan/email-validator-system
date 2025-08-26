import { z } from 'zod';
export declare const emailValidationSchema: z.ZodObject<{
    email: z.ZodString;
}, "strip", z.ZodTypeAny, {
    email: string;
}, {
    email: string;
}>;
export declare const batchEmailValidationSchema: z.ZodObject<{
    emails: z.ZodArray<z.ZodString, "many">;
}, "strip", z.ZodTypeAny, {
    emails: string[];
}, {
    emails: string[];
}>;
export declare const userRegistrationSchema: z.ZodObject<{
    name: z.ZodString;
    email: z.ZodString;
    password: z.ZodString;
}, "strip", z.ZodTypeAny, {
    email: string;
    name: string;
    password: string;
}, {
    email: string;
    name: string;
    password: string;
}>;
export declare const userLoginSchema: z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
}, "strip", z.ZodTypeAny, {
    email: string;
    password: string;
}, {
    email: string;
    password: string;
}>;
export declare const apiKeyCreationSchema: z.ZodObject<{
    keyName: z.ZodString;
    rateLimit: z.ZodOptional<z.ZodNumber>;
    expiryDays: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    keyName: string;
    rateLimit?: number | undefined;
    expiryDays?: number | undefined;
}, {
    keyName: string;
    rateLimit?: number | undefined;
    expiryDays?: number | undefined;
}>;
export declare const contactSchema: z.ZodObject<{
    email: z.ZodString;
    firstName: z.ZodOptional<z.ZodString>;
    lastName: z.ZodOptional<z.ZodString>;
    phone: z.ZodOptional<z.ZodString>;
    company: z.ZodOptional<z.ZodString>;
    customFields: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    notes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    email: string;
    firstName?: string | undefined;
    lastName?: string | undefined;
    phone?: string | undefined;
    company?: string | undefined;
    customFields?: Record<string, string> | undefined;
    tags?: string[] | undefined;
    notes?: string | undefined;
}, {
    email: string;
    firstName?: string | undefined;
    lastName?: string | undefined;
    phone?: string | undefined;
    company?: string | undefined;
    customFields?: Record<string, string> | undefined;
    tags?: string[] | undefined;
    notes?: string | undefined;
}>;
export declare const contactListSchema: z.ZodObject<{
    name: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    name: string;
    tags?: string[] | undefined;
    description?: string | undefined;
}, {
    name: string;
    tags?: string[] | undefined;
    description?: string | undefined;
}>;
export declare const bulkContactImportSchema: z.ZodObject<{
    contactListId: z.ZodNumber;
    contacts: z.ZodArray<z.ZodObject<{
        email: z.ZodString;
        firstName: z.ZodOptional<z.ZodString>;
        lastName: z.ZodOptional<z.ZodString>;
        phone: z.ZodOptional<z.ZodString>;
        company: z.ZodOptional<z.ZodString>;
        customFields: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
        tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        notes: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        email: string;
        firstName?: string | undefined;
        lastName?: string | undefined;
        phone?: string | undefined;
        company?: string | undefined;
        customFields?: Record<string, string> | undefined;
        tags?: string[] | undefined;
        notes?: string | undefined;
    }, {
        email: string;
        firstName?: string | undefined;
        lastName?: string | undefined;
        phone?: string | undefined;
        company?: string | undefined;
        customFields?: Record<string, string> | undefined;
        tags?: string[] | undefined;
        notes?: string | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    contactListId: number;
    contacts: {
        email: string;
        firstName?: string | undefined;
        lastName?: string | undefined;
        phone?: string | undefined;
        company?: string | undefined;
        customFields?: Record<string, string> | undefined;
        tags?: string[] | undefined;
        notes?: string | undefined;
    }[];
}, {
    contactListId: number;
    contacts: {
        email: string;
        firstName?: string | undefined;
        lastName?: string | undefined;
        phone?: string | undefined;
        company?: string | undefined;
        customFields?: Record<string, string> | undefined;
        tags?: string[] | undefined;
        notes?: string | undefined;
    }[];
}>;
export type EmailValidationRequest = z.infer<typeof emailValidationSchema>;
export type BatchEmailValidationRequest = z.infer<typeof batchEmailValidationSchema>;
export type UserRegistrationRequest = z.infer<typeof userRegistrationSchema>;
export type UserLoginRequest = z.infer<typeof userLoginSchema>;
export type ApiKeyCreationRequest = z.infer<typeof apiKeyCreationSchema>;
export type ContactRequest = z.infer<typeof contactSchema>;
export type ContactListRequest = z.infer<typeof contactListSchema>;
export type BulkContactImportRequest = z.infer<typeof bulkContactImportSchema>;
//# sourceMappingURL=validation.d.ts.map