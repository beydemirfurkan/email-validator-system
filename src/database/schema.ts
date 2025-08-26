import { sqliteTable, integer, text, real, blob } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  email: text('email').notNull().unique(),
  password: text('password').notNull(),
  name: text('name').notNull(),
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`),
  updatedAt: text('updated_at').default(sql`(CURRENT_TIMESTAMP)`)
});

export const apiKeys = sqliteTable('api_keys', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id),
  keyName: text('key_name').notNull(),
  apiKey: text('api_key').notNull().unique(),
  lastUsedAt: text('last_used_at'),
  expiresAt: text('expires_at'),
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  rateLimit: integer('rate_limit').default(100),
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`),
  updatedAt: text('updated_at').default(sql`(CURRENT_TIMESTAMP)`)
});

export const plans = sqliteTable('plans', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  description: text('description'),
  price: real('price').notNull(),
  billingCycle: text('billing_cycle', { enum: ['monthly', 'yearly'] }).notNull(),
  validationsPerMonth: integer('validations_per_month').notNull(),
  maxApiKeys: integer('max_api_keys').default(1),
  maxContactLists: integer('max_contact_lists').default(1),
  bulkValidation: integer('bulk_validation', { mode: 'boolean' }).default(false),
  apiAccess: integer('api_access', { mode: 'boolean' }).default(true),
  prioritySupport: integer('priority_support', { mode: 'boolean' }).default(false),
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`),
  updatedAt: text('updated_at').default(sql`(CURRENT_TIMESTAMP)`)
});

export const planFeatures = sqliteTable('plan_features', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  planId: integer('plan_id').notNull().references(() => plans.id),
  featureName: text('feature_name').notNull(),
  featureValue: text('feature_value'),
  isEnabled: integer('is_enabled', { mode: 'boolean' }).default(true),
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`),
  updatedAt: text('updated_at').default(sql`(CURRENT_TIMESTAMP)`)
});

export const userSubscriptions = sqliteTable('user_subscriptions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id),
  planId: integer('plan_id').notNull().references(() => plans.id),
  status: text('status', { enum: ['active', 'cancelled', 'expired', 'pending'] }).default('pending'),
  currentPeriodStart: text('current_period_start'),
  currentPeriodEnd: text('current_period_end'),
  cancelAtPeriodEnd: integer('cancel_at_period_end', { mode: 'boolean' }).default(false),
  stripeSubscriptionId: text('stripe_subscription_id'),
  stripeCustomerId: text('stripe_customer_id'),
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`),
  updatedAt: text('updated_at').default(sql`(CURRENT_TIMESTAMP)`)
});

export const usageQuotas = sqliteTable('usage_quotas', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id),
  planId: integer('plan_id').notNull().references(() => plans.id),
  currentPeriodStart: text('current_period_start').notNull(),
  currentPeriodEnd: text('current_period_end').notNull(),
  validationsUsed: integer('validations_used').default(0),
  validationsLimit: integer('validations_limit').notNull(),
  apiCallsUsed: integer('api_calls_used').default(0),
  apiCallsLimit: integer('api_calls_limit').default(-1),
  lastResetAt: text('last_reset_at'),
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`),
  updatedAt: text('updated_at').default(sql`(CURRENT_TIMESTAMP)`)
});

export const contactLists = sqliteTable('contact_lists', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id),
  name: text('name').notNull(),
  description: text('description'),
  totalContacts: integer('total_contacts').default(0),
  validContacts: integer('valid_contacts').default(0),
  invalidContacts: integer('invalid_contacts').default(0),
  riskyContacts: integer('risky_contacts').default(0),
  unknownContacts: integer('unknown_contacts').default(0),
  lastValidatedAt: text('last_validated_at'),
  tags: text('tags', { mode: 'json' }),
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`),
  updatedAt: text('updated_at').default(sql`(CURRENT_TIMESTAMP)`)
});

export const contacts = sqliteTable('contacts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  contactListId: integer('contact_list_id').notNull().references(() => contactLists.id),
  email: text('email').notNull(),
  firstName: text('first_name'),
  lastName: text('last_name'),
  phone: text('phone'),
  company: text('company'),
  customFields: text('custom_fields', { mode: 'json' }),
  validationStatus: text('validation_status', { 
    enum: ['pending', 'validating', 'valid', 'invalid', 'risky', 'unknown'] 
  }).default('pending'),
  validationResult: text('validation_result', { mode: 'json' }),
  validationScore: real('validation_score'),
  lastValidatedAt: text('last_validated_at'),
  tags: text('tags', { mode: 'json' }),
  notes: text('notes'),
  isSubscribed: integer('is_subscribed', { mode: 'boolean' }).default(true),
  bouncedAt: text('bounced_at'),
  unsubscribedAt: text('unsubscribed_at'),
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`),
  updatedAt: text('updated_at').default(sql`(CURRENT_TIMESTAMP)`)
});

export const validationLogs = sqliteTable('validation_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id),
  apiKeyId: integer('api_key_id').references(() => apiKeys.id),
  emailValidated: text('email_validated').notNull(),
  validationResult: text('validation_result', { mode: 'json' }).notNull(),
  processingTimeMs: integer('processing_time_ms'),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`),
  updatedAt: text('updated_at').default(sql`(CURRENT_TIMESTAMP)`)
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type ApiKey = typeof apiKeys.$inferSelect;
export type NewApiKey = typeof apiKeys.$inferInsert;
export type Plan = typeof plans.$inferSelect;
export type NewPlan = typeof plans.$inferInsert;
export type PlanFeature = typeof planFeatures.$inferSelect;
export type NewPlanFeature = typeof planFeatures.$inferInsert;
export type UserSubscription = typeof userSubscriptions.$inferSelect;
export type NewUserSubscription = typeof userSubscriptions.$inferInsert;
export type UsageQuota = typeof usageQuotas.$inferSelect;
export type NewUsageQuota = typeof usageQuotas.$inferInsert;
export type ContactList = typeof contactLists.$inferSelect;
export type NewContactList = typeof contactLists.$inferInsert;
export type Contact = typeof contacts.$inferSelect;
export type NewContact = typeof contacts.$inferInsert;
export type ValidationLog = typeof validationLogs.$inferSelect;
export type NewValidationLog = typeof validationLogs.$inferInsert;