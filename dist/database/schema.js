"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validationLogs = exports.contacts = exports.contactLists = exports.usageQuotas = exports.userSubscriptions = exports.planFeatures = exports.plans = exports.apiKeys = exports.users = void 0;
const sqlite_core_1 = require("drizzle-orm/sqlite-core");
const drizzle_orm_1 = require("drizzle-orm");
exports.users = (0, sqlite_core_1.sqliteTable)('users', {
    id: (0, sqlite_core_1.integer)('id').primaryKey({ autoIncrement: true }),
    email: (0, sqlite_core_1.text)('email').notNull().unique(),
    password: (0, sqlite_core_1.text)('password').notNull(),
    name: (0, sqlite_core_1.text)('name').notNull(),
    isActive: (0, sqlite_core_1.integer)('is_active', { mode: 'boolean' }).default(true),
    createdAt: (0, sqlite_core_1.text)('created_at').default((0, drizzle_orm_1.sql) `(CURRENT_TIMESTAMP)`),
    updatedAt: (0, sqlite_core_1.text)('updated_at').default((0, drizzle_orm_1.sql) `(CURRENT_TIMESTAMP)`)
});
exports.apiKeys = (0, sqlite_core_1.sqliteTable)('api_keys', {
    id: (0, sqlite_core_1.integer)('id').primaryKey({ autoIncrement: true }),
    userId: (0, sqlite_core_1.integer)('user_id').notNull().references(() => exports.users.id),
    keyName: (0, sqlite_core_1.text)('key_name').notNull(),
    apiKey: (0, sqlite_core_1.text)('api_key').notNull().unique(),
    lastUsedAt: (0, sqlite_core_1.text)('last_used_at'),
    expiresAt: (0, sqlite_core_1.text)('expires_at'),
    isActive: (0, sqlite_core_1.integer)('is_active', { mode: 'boolean' }).default(true),
    rateLimit: (0, sqlite_core_1.integer)('rate_limit').default(100),
    createdAt: (0, sqlite_core_1.text)('created_at').default((0, drizzle_orm_1.sql) `(CURRENT_TIMESTAMP)`),
    updatedAt: (0, sqlite_core_1.text)('updated_at').default((0, drizzle_orm_1.sql) `(CURRENT_TIMESTAMP)`)
});
exports.plans = (0, sqlite_core_1.sqliteTable)('plans', {
    id: (0, sqlite_core_1.integer)('id').primaryKey({ autoIncrement: true }),
    name: (0, sqlite_core_1.text)('name').notNull(),
    description: (0, sqlite_core_1.text)('description'),
    price: (0, sqlite_core_1.real)('price').notNull(),
    billingCycle: (0, sqlite_core_1.text)('billing_cycle', { enum: ['monthly', 'yearly'] }).notNull(),
    validationsPerMonth: (0, sqlite_core_1.integer)('validations_per_month').notNull(),
    maxApiKeys: (0, sqlite_core_1.integer)('max_api_keys').default(1),
    maxContactLists: (0, sqlite_core_1.integer)('max_contact_lists').default(1),
    bulkValidation: (0, sqlite_core_1.integer)('bulk_validation', { mode: 'boolean' }).default(false),
    apiAccess: (0, sqlite_core_1.integer)('api_access', { mode: 'boolean' }).default(true),
    prioritySupport: (0, sqlite_core_1.integer)('priority_support', { mode: 'boolean' }).default(false),
    isActive: (0, sqlite_core_1.integer)('is_active', { mode: 'boolean' }).default(true),
    createdAt: (0, sqlite_core_1.text)('created_at').default((0, drizzle_orm_1.sql) `(CURRENT_TIMESTAMP)`),
    updatedAt: (0, sqlite_core_1.text)('updated_at').default((0, drizzle_orm_1.sql) `(CURRENT_TIMESTAMP)`)
});
exports.planFeatures = (0, sqlite_core_1.sqliteTable)('plan_features', {
    id: (0, sqlite_core_1.integer)('id').primaryKey({ autoIncrement: true }),
    planId: (0, sqlite_core_1.integer)('plan_id').notNull().references(() => exports.plans.id),
    featureName: (0, sqlite_core_1.text)('feature_name').notNull(),
    featureValue: (0, sqlite_core_1.text)('feature_value'),
    isEnabled: (0, sqlite_core_1.integer)('is_enabled', { mode: 'boolean' }).default(true),
    createdAt: (0, sqlite_core_1.text)('created_at').default((0, drizzle_orm_1.sql) `(CURRENT_TIMESTAMP)`),
    updatedAt: (0, sqlite_core_1.text)('updated_at').default((0, drizzle_orm_1.sql) `(CURRENT_TIMESTAMP)`)
});
exports.userSubscriptions = (0, sqlite_core_1.sqliteTable)('user_subscriptions', {
    id: (0, sqlite_core_1.integer)('id').primaryKey({ autoIncrement: true }),
    userId: (0, sqlite_core_1.integer)('user_id').notNull().references(() => exports.users.id),
    planId: (0, sqlite_core_1.integer)('plan_id').notNull().references(() => exports.plans.id),
    status: (0, sqlite_core_1.text)('status', { enum: ['active', 'cancelled', 'expired', 'pending'] }).default('pending'),
    currentPeriodStart: (0, sqlite_core_1.text)('current_period_start'),
    currentPeriodEnd: (0, sqlite_core_1.text)('current_period_end'),
    cancelAtPeriodEnd: (0, sqlite_core_1.integer)('cancel_at_period_end', { mode: 'boolean' }).default(false),
    stripeSubscriptionId: (0, sqlite_core_1.text)('stripe_subscription_id'),
    stripeCustomerId: (0, sqlite_core_1.text)('stripe_customer_id'),
    createdAt: (0, sqlite_core_1.text)('created_at').default((0, drizzle_orm_1.sql) `(CURRENT_TIMESTAMP)`),
    updatedAt: (0, sqlite_core_1.text)('updated_at').default((0, drizzle_orm_1.sql) `(CURRENT_TIMESTAMP)`)
});
exports.usageQuotas = (0, sqlite_core_1.sqliteTable)('usage_quotas', {
    id: (0, sqlite_core_1.integer)('id').primaryKey({ autoIncrement: true }),
    userId: (0, sqlite_core_1.integer)('user_id').notNull().references(() => exports.users.id),
    planId: (0, sqlite_core_1.integer)('plan_id').notNull().references(() => exports.plans.id),
    currentPeriodStart: (0, sqlite_core_1.text)('current_period_start').notNull(),
    currentPeriodEnd: (0, sqlite_core_1.text)('current_period_end').notNull(),
    validationsUsed: (0, sqlite_core_1.integer)('validations_used').default(0),
    validationsLimit: (0, sqlite_core_1.integer)('validations_limit').notNull(),
    apiCallsUsed: (0, sqlite_core_1.integer)('api_calls_used').default(0),
    apiCallsLimit: (0, sqlite_core_1.integer)('api_calls_limit').default(-1),
    lastResetAt: (0, sqlite_core_1.text)('last_reset_at'),
    createdAt: (0, sqlite_core_1.text)('created_at').default((0, drizzle_orm_1.sql) `(CURRENT_TIMESTAMP)`),
    updatedAt: (0, sqlite_core_1.text)('updated_at').default((0, drizzle_orm_1.sql) `(CURRENT_TIMESTAMP)`)
});
exports.contactLists = (0, sqlite_core_1.sqliteTable)('contact_lists', {
    id: (0, sqlite_core_1.integer)('id').primaryKey({ autoIncrement: true }),
    userId: (0, sqlite_core_1.integer)('user_id').notNull().references(() => exports.users.id),
    name: (0, sqlite_core_1.text)('name').notNull(),
    description: (0, sqlite_core_1.text)('description'),
    totalContacts: (0, sqlite_core_1.integer)('total_contacts').default(0),
    validContacts: (0, sqlite_core_1.integer)('valid_contacts').default(0),
    invalidContacts: (0, sqlite_core_1.integer)('invalid_contacts').default(0),
    riskyContacts: (0, sqlite_core_1.integer)('risky_contacts').default(0),
    unknownContacts: (0, sqlite_core_1.integer)('unknown_contacts').default(0),
    lastValidatedAt: (0, sqlite_core_1.text)('last_validated_at'),
    tags: (0, sqlite_core_1.text)('tags', { mode: 'json' }),
    isActive: (0, sqlite_core_1.integer)('is_active', { mode: 'boolean' }).default(true),
    createdAt: (0, sqlite_core_1.text)('created_at').default((0, drizzle_orm_1.sql) `(CURRENT_TIMESTAMP)`),
    updatedAt: (0, sqlite_core_1.text)('updated_at').default((0, drizzle_orm_1.sql) `(CURRENT_TIMESTAMP)`)
});
exports.contacts = (0, sqlite_core_1.sqliteTable)('contacts', {
    id: (0, sqlite_core_1.integer)('id').primaryKey({ autoIncrement: true }),
    contactListId: (0, sqlite_core_1.integer)('contact_list_id').notNull().references(() => exports.contactLists.id),
    email: (0, sqlite_core_1.text)('email').notNull(),
    firstName: (0, sqlite_core_1.text)('first_name'),
    lastName: (0, sqlite_core_1.text)('last_name'),
    phone: (0, sqlite_core_1.text)('phone'),
    company: (0, sqlite_core_1.text)('company'),
    customFields: (0, sqlite_core_1.text)('custom_fields', { mode: 'json' }),
    validationStatus: (0, sqlite_core_1.text)('validation_status', {
        enum: ['pending', 'validating', 'valid', 'invalid', 'risky', 'unknown']
    }).default('pending'),
    validationResult: (0, sqlite_core_1.text)('validation_result', { mode: 'json' }),
    validationScore: (0, sqlite_core_1.real)('validation_score'),
    lastValidatedAt: (0, sqlite_core_1.text)('last_validated_at'),
    tags: (0, sqlite_core_1.text)('tags', { mode: 'json' }),
    notes: (0, sqlite_core_1.text)('notes'),
    isSubscribed: (0, sqlite_core_1.integer)('is_subscribed', { mode: 'boolean' }).default(true),
    bouncedAt: (0, sqlite_core_1.text)('bounced_at'),
    unsubscribedAt: (0, sqlite_core_1.text)('unsubscribed_at'),
    createdAt: (0, sqlite_core_1.text)('created_at').default((0, drizzle_orm_1.sql) `(CURRENT_TIMESTAMP)`),
    updatedAt: (0, sqlite_core_1.text)('updated_at').default((0, drizzle_orm_1.sql) `(CURRENT_TIMESTAMP)`)
});
exports.validationLogs = (0, sqlite_core_1.sqliteTable)('validation_logs', {
    id: (0, sqlite_core_1.integer)('id').primaryKey({ autoIncrement: true }),
    userId: (0, sqlite_core_1.integer)('user_id').notNull().references(() => exports.users.id),
    apiKeyId: (0, sqlite_core_1.integer)('api_key_id').references(() => exports.apiKeys.id),
    emailValidated: (0, sqlite_core_1.text)('email_validated').notNull(),
    validationResult: (0, sqlite_core_1.text)('validation_result', { mode: 'json' }).notNull(),
    processingTimeMs: (0, sqlite_core_1.integer)('processing_time_ms'),
    ipAddress: (0, sqlite_core_1.text)('ip_address'),
    userAgent: (0, sqlite_core_1.text)('user_agent'),
    createdAt: (0, sqlite_core_1.text)('created_at').default((0, drizzle_orm_1.sql) `(CURRENT_TIMESTAMP)`),
    updatedAt: (0, sqlite_core_1.text)('updated_at').default((0, drizzle_orm_1.sql) `(CURRENT_TIMESTAMP)`)
});
//# sourceMappingURL=schema.js.map