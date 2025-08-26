import { pgTable, serial, varchar, text, real, boolean, timestamp, integer, json } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  password: varchar('password', { length: 255 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

export const apiKeys = pgTable('api_keys', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id),
  keyName: varchar('key_name', { length: 255 }).notNull(),
  apiKey: varchar('api_key', { length: 255 }).notNull().unique(),
  lastUsedAt: timestamp('last_used_at'),
  expiresAt: timestamp('expires_at'),
  isActive: boolean('is_active').default(true),
  rateLimit: integer('rate_limit').default(100),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

export const plans = pgTable('plans', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  price: real('price').notNull(),
  billingCycle: varchar('billing_cycle', { length: 20 }).notNull(),
  validationsPerMonth: integer('validations_per_month').notNull(),
  maxApiKeys: integer('max_api_keys').default(1),
  maxContactLists: integer('max_contact_lists').default(1),
  bulkValidation: boolean('bulk_validation').default(false),
  apiAccess: boolean('api_access').default(true),
  prioritySupport: boolean('priority_support').default(false),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

export const planFeatures = pgTable('plan_features', {
  id: serial('id').primaryKey(),
  planId: integer('plan_id').notNull().references(() => plans.id),
  featureName: varchar('feature_name', { length: 255 }).notNull(),
  featureValue: varchar('feature_value', { length: 255 }),
  isEnabled: boolean('is_enabled').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

export const userSubscriptions = pgTable('user_subscriptions', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id),
  planId: integer('plan_id').notNull().references(() => plans.id),
  status: varchar('status', { length: 20 }).default('pending'),
  currentPeriodStart: timestamp('current_period_start'),
  currentPeriodEnd: timestamp('current_period_end'),
  cancelAtPeriodEnd: boolean('cancel_at_period_end').default(false),
  stripeSubscriptionId: varchar('stripe_subscription_id', { length: 255 }),
  stripeCustomerId: varchar('stripe_customer_id', { length: 255 }),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

export const usageQuotas = pgTable('usage_quotas', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id),
  planId: integer('plan_id').notNull().references(() => plans.id),
  currentPeriodStart: timestamp('current_period_start').notNull(),
  currentPeriodEnd: timestamp('current_period_end').notNull(),
  validationsUsed: integer('validations_used').default(0),
  validationsLimit: integer('validations_limit').notNull(),
  apiCallsUsed: integer('api_calls_used').default(0),
  apiCallsLimit: integer('api_calls_limit').default(-1),
  lastResetAt: timestamp('last_reset_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

export const contactLists = pgTable('contact_lists', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  totalContacts: integer('total_contacts').default(0),
  validContacts: integer('valid_contacts').default(0),
  invalidContacts: integer('invalid_contacts').default(0),
  riskyContacts: integer('risky_contacts').default(0),
  unknownContacts: integer('unknown_contacts').default(0),
  lastValidatedAt: timestamp('last_validated_at'),
  tags: json('tags'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

export const contacts = pgTable('contacts', {
  id: serial('id').primaryKey(),
  contactListId: integer('contact_list_id').notNull().references(() => contactLists.id),
  email: varchar('email', { length: 255 }).notNull(),
  firstName: varchar('first_name', { length: 255 }),
  lastName: varchar('last_name', { length: 255 }),
  phone: varchar('phone', { length: 50 }),
  company: varchar('company', { length: 255 }),
  customFields: json('custom_fields'),
  validationStatus: varchar('validation_status', { length: 20 }).default('pending'),
  validationResult: json('validation_result'),
  validationScore: real('validation_score'),
  lastValidatedAt: timestamp('last_validated_at'),
  tags: json('tags'),
  notes: text('notes'),
  isSubscribed: boolean('is_subscribed').default(true),
  bouncedAt: timestamp('bounced_at'),
  unsubscribedAt: timestamp('unsubscribed_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

export const validationLogs = pgTable('validation_logs', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id),
  apiKeyId: integer('api_key_id').references(() => apiKeys.id),
  emailValidated: varchar('email_validated', { length: 255 }).notNull(),
  validationResult: json('validation_result').notNull(),
  processingTimeMs: integer('processing_time_ms'),
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
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