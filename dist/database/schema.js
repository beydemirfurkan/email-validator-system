"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validationLogs = exports.contacts = exports.contactLists = exports.usageQuotas = exports.userSubscriptions = exports.planFeatures = exports.plans = exports.apiKeys = exports.users = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
exports.users = (0, pg_core_1.pgTable)('users', {
    id: (0, pg_core_1.serial)('id').primaryKey(),
    email: (0, pg_core_1.varchar)('email', { length: 255 }).notNull().unique(),
    password: (0, pg_core_1.varchar)('password', { length: 255 }).notNull(),
    name: (0, pg_core_1.varchar)('name', { length: 255 }).notNull(),
    isActive: (0, pg_core_1.boolean)('is_active').default(true),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow()
});
exports.apiKeys = (0, pg_core_1.pgTable)('api_keys', {
    id: (0, pg_core_1.serial)('id').primaryKey(),
    userId: (0, pg_core_1.integer)('user_id').notNull().references(() => exports.users.id),
    keyName: (0, pg_core_1.varchar)('key_name', { length: 255 }).notNull(),
    apiKey: (0, pg_core_1.varchar)('api_key', { length: 255 }).notNull().unique(),
    lastUsedAt: (0, pg_core_1.timestamp)('last_used_at'),
    expiresAt: (0, pg_core_1.timestamp)('expires_at'),
    isActive: (0, pg_core_1.boolean)('is_active').default(true),
    rateLimit: (0, pg_core_1.integer)('rate_limit').default(100),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow()
});
exports.plans = (0, pg_core_1.pgTable)('plans', {
    id: (0, pg_core_1.serial)('id').primaryKey(),
    name: (0, pg_core_1.varchar)('name', { length: 255 }).notNull(),
    description: (0, pg_core_1.text)('description'),
    price: (0, pg_core_1.real)('price').notNull(),
    billingCycle: (0, pg_core_1.varchar)('billing_cycle', { length: 20 }).notNull(),
    validationsPerMonth: (0, pg_core_1.integer)('validations_per_month').notNull(),
    maxApiKeys: (0, pg_core_1.integer)('max_api_keys').default(1),
    maxContactLists: (0, pg_core_1.integer)('max_contact_lists').default(1),
    bulkValidation: (0, pg_core_1.boolean)('bulk_validation').default(false),
    apiAccess: (0, pg_core_1.boolean)('api_access').default(true),
    prioritySupport: (0, pg_core_1.boolean)('priority_support').default(false),
    isActive: (0, pg_core_1.boolean)('is_active').default(true),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow()
});
exports.planFeatures = (0, pg_core_1.pgTable)('plan_features', {
    id: (0, pg_core_1.serial)('id').primaryKey(),
    planId: (0, pg_core_1.integer)('plan_id').notNull().references(() => exports.plans.id),
    featureName: (0, pg_core_1.varchar)('feature_name', { length: 255 }).notNull(),
    featureValue: (0, pg_core_1.varchar)('feature_value', { length: 255 }),
    isEnabled: (0, pg_core_1.boolean)('is_enabled').default(true),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow()
});
exports.userSubscriptions = (0, pg_core_1.pgTable)('user_subscriptions', {
    id: (0, pg_core_1.serial)('id').primaryKey(),
    userId: (0, pg_core_1.integer)('user_id').notNull().references(() => exports.users.id),
    planId: (0, pg_core_1.integer)('plan_id').notNull().references(() => exports.plans.id),
    status: (0, pg_core_1.varchar)('status', { length: 20 }).default('pending'),
    currentPeriodStart: (0, pg_core_1.timestamp)('current_period_start'),
    currentPeriodEnd: (0, pg_core_1.timestamp)('current_period_end'),
    cancelAtPeriodEnd: (0, pg_core_1.boolean)('cancel_at_period_end').default(false),
    stripeSubscriptionId: (0, pg_core_1.varchar)('stripe_subscription_id', { length: 255 }),
    stripeCustomerId: (0, pg_core_1.varchar)('stripe_customer_id', { length: 255 }),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow()
});
exports.usageQuotas = (0, pg_core_1.pgTable)('usage_quotas', {
    id: (0, pg_core_1.serial)('id').primaryKey(),
    userId: (0, pg_core_1.integer)('user_id').notNull().references(() => exports.users.id),
    planId: (0, pg_core_1.integer)('plan_id').notNull().references(() => exports.plans.id),
    currentPeriodStart: (0, pg_core_1.timestamp)('current_period_start').notNull(),
    currentPeriodEnd: (0, pg_core_1.timestamp)('current_period_end').notNull(),
    validationsUsed: (0, pg_core_1.integer)('validations_used').default(0),
    validationsLimit: (0, pg_core_1.integer)('validations_limit').notNull(),
    apiCallsUsed: (0, pg_core_1.integer)('api_calls_used').default(0),
    apiCallsLimit: (0, pg_core_1.integer)('api_calls_limit').default(-1),
    lastResetAt: (0, pg_core_1.timestamp)('last_reset_at'),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow()
});
exports.contactLists = (0, pg_core_1.pgTable)('contact_lists', {
    id: (0, pg_core_1.serial)('id').primaryKey(),
    userId: (0, pg_core_1.integer)('user_id').notNull().references(() => exports.users.id),
    name: (0, pg_core_1.varchar)('name', { length: 255 }).notNull(),
    description: (0, pg_core_1.text)('description'),
    totalContacts: (0, pg_core_1.integer)('total_contacts').default(0),
    validContacts: (0, pg_core_1.integer)('valid_contacts').default(0),
    invalidContacts: (0, pg_core_1.integer)('invalid_contacts').default(0),
    riskyContacts: (0, pg_core_1.integer)('risky_contacts').default(0),
    unknownContacts: (0, pg_core_1.integer)('unknown_contacts').default(0),
    lastValidatedAt: (0, pg_core_1.timestamp)('last_validated_at'),
    tags: (0, pg_core_1.json)('tags'),
    isActive: (0, pg_core_1.boolean)('is_active').default(true),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow()
});
exports.contacts = (0, pg_core_1.pgTable)('contacts', {
    id: (0, pg_core_1.serial)('id').primaryKey(),
    contactListId: (0, pg_core_1.integer)('contact_list_id').notNull().references(() => exports.contactLists.id),
    email: (0, pg_core_1.varchar)('email', { length: 255 }).notNull(),
    firstName: (0, pg_core_1.varchar)('first_name', { length: 255 }),
    lastName: (0, pg_core_1.varchar)('last_name', { length: 255 }),
    phone: (0, pg_core_1.varchar)('phone', { length: 50 }),
    company: (0, pg_core_1.varchar)('company', { length: 255 }),
    customFields: (0, pg_core_1.json)('custom_fields'),
    validationStatus: (0, pg_core_1.varchar)('validation_status', { length: 20 }).default('pending'),
    validationResult: (0, pg_core_1.json)('validation_result'),
    validationScore: (0, pg_core_1.real)('validation_score'),
    lastValidatedAt: (0, pg_core_1.timestamp)('last_validated_at'),
    tags: (0, pg_core_1.json)('tags'),
    notes: (0, pg_core_1.text)('notes'),
    isSubscribed: (0, pg_core_1.boolean)('is_subscribed').default(true),
    bouncedAt: (0, pg_core_1.timestamp)('bounced_at'),
    unsubscribedAt: (0, pg_core_1.timestamp)('unsubscribed_at'),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow()
});
exports.validationLogs = (0, pg_core_1.pgTable)('validation_logs', {
    id: (0, pg_core_1.serial)('id').primaryKey(),
    userId: (0, pg_core_1.integer)('user_id').notNull().references(() => exports.users.id),
    apiKeyId: (0, pg_core_1.integer)('api_key_id').references(() => exports.apiKeys.id),
    emailValidated: (0, pg_core_1.varchar)('email_validated', { length: 255 }).notNull(),
    validationResult: (0, pg_core_1.json)('validation_result').notNull(),
    processingTimeMs: (0, pg_core_1.integer)('processing_time_ms'),
    ipAddress: (0, pg_core_1.varchar)('ip_address', { length: 45 }),
    userAgent: (0, pg_core_1.text)('user_agent'),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow()
});
//# sourceMappingURL=schema.js.map