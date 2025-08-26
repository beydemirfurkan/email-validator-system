-- Database Performance Optimization: Index Strategy
-- Created for Email Validator API Performance Enhancement

-- =======================================================
-- USERS TABLE INDEXES
-- =======================================================

-- Primary search by email (login, registration checks)
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Active users filter
CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active);

-- User creation date for analytics
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);

-- =======================================================
-- API KEYS TABLE INDEXES
-- =======================================================

-- Primary API key lookup by hashed key
CREATE INDEX IF NOT EXISTS idx_apikeys_key ON api_keys(api_key);

-- User's API keys lookup
CREATE INDEX IF NOT EXISTS idx_apikeys_user ON api_keys(user_id);

-- Active API keys filter
CREATE INDEX IF NOT EXISTS idx_apikeys_active ON api_keys(is_active);

-- Expired API keys cleanup
CREATE INDEX IF NOT EXISTS idx_apikeys_expires ON api_keys(expires_at);

-- Composite index for active user API keys
CREATE INDEX IF NOT EXISTS idx_apikeys_user_active ON api_keys(user_id, is_active);

-- Last used date for analytics
CREATE INDEX IF NOT EXISTS idx_apikeys_last_used ON api_keys(last_used_at);

-- =======================================================
-- VALIDATION LOGS TABLE INDEXES
-- =======================================================

-- User's validation history
CREATE INDEX IF NOT EXISTS idx_validationlogs_user ON validation_logs(user_id);

-- API key usage tracking
CREATE INDEX IF NOT EXISTS idx_validationlogs_apikey ON validation_logs(api_key_id);

-- Email validation lookup
CREATE INDEX IF NOT EXISTS idx_validationlogs_email ON validation_logs(email_validated);

-- Time-based queries (analytics, recent validations)
CREATE INDEX IF NOT EXISTS idx_validationlogs_created ON validation_logs(created_at);

-- Composite index for user validation history with time
CREATE INDEX IF NOT EXISTS idx_validationlogs_user_time ON validation_logs(user_id, created_at DESC);

-- Performance monitoring (slow requests)
CREATE INDEX IF NOT EXISTS idx_validationlogs_processing_time ON validation_logs(processing_time_ms);

-- =======================================================
-- CONTACT LISTS TABLE INDEXES
-- =======================================================

-- User's contact lists
CREATE INDEX IF NOT EXISTS idx_contactlists_user ON contact_lists(user_id);

-- Active contact lists
CREATE INDEX IF NOT EXISTS idx_contactlists_active ON contact_lists(is_active);

-- Last validated date for maintenance
CREATE INDEX IF NOT EXISTS idx_contactlists_validated ON contact_lists(last_validated_at);

-- Composite index for user's active lists
CREATE INDEX IF NOT EXISTS idx_contactlists_user_active ON contact_lists(user_id, is_active);

-- =======================================================
-- CONTACTS TABLE INDEXES
-- =======================================================

-- Contact list's contacts
CREATE INDEX IF NOT EXISTS idx_contacts_list ON contacts(contact_list_id);

-- Email lookup for duplicate prevention
CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email);

-- Validation status filtering
CREATE INDEX IF NOT EXISTS idx_contacts_validation_status ON contacts(validation_status);

-- Last validated for maintenance
CREATE INDEX IF NOT EXISTS idx_contacts_last_validated ON contacts(last_validated_at);

-- Composite index for list contacts with status
CREATE INDEX IF NOT EXISTS idx_contacts_list_status ON contacts(contact_list_id, validation_status);

-- Subscription status for email campaigns
CREATE INDEX IF NOT EXISTS idx_contacts_subscribed ON contacts(is_subscribed);

-- =======================================================
-- PLANS AND SUBSCRIPTIONS INDEXES
-- =======================================================

-- Active plans lookup
CREATE INDEX IF NOT EXISTS idx_plans_active ON plans(is_active);

-- User subscriptions
CREATE INDEX IF NOT EXISTS idx_usersubscriptions_user ON user_subscriptions(user_id);

-- Active subscriptions
CREATE INDEX IF NOT EXISTS idx_usersubscriptions_status ON user_subscriptions(status);

-- Subscription expiry monitoring
CREATE INDEX IF NOT EXISTS idx_usersubscriptions_period_end ON user_subscriptions(current_period_end);

-- =======================================================
-- USAGE QUOTAS INDEXES
-- =======================================================

-- User quotas lookup
CREATE INDEX IF NOT EXISTS idx_usagequotas_user ON usage_quotas(user_id);

-- Current period quotas
CREATE INDEX IF NOT EXISTS idx_usagequotas_period ON usage_quotas(current_period_start, current_period_end);

-- Quota reset monitoring
CREATE INDEX IF NOT EXISTS idx_usagequotas_reset ON usage_quotas(last_reset_at);

-- =======================================================
-- SQLITE PERFORMANCE OPTIMIZATIONS
-- =======================================================

-- Enable Write-Ahead Logging for better concurrent access
PRAGMA journal_mode = WAL;

-- Optimize synchronization for performance vs durability balance
PRAGMA synchronous = NORMAL;

-- Increase cache size for better query performance
PRAGMA cache_size = 2000;

-- Store temporary tables in memory
PRAGMA temp_store = MEMORY;

-- Enable memory mapping for large databases
PRAGMA mmap_size = 536870912; -- 512MB

-- Enable foreign key constraints
PRAGMA foreign_keys = ON;

-- Set busy timeout for concurrent access
PRAGMA busy_timeout = 10000; -- 10 seconds

-- Optimize page size for better I/O performance
-- Note: This can only be set on empty databases
-- PRAGMA page_size = 4096;

-- =======================================================
-- MAINTENANCE QUERIES
-- =======================================================

-- Analyze tables for query planner optimization
ANALYZE;

-- Vacuum to reclaim space and optimize file structure
-- Note: Use periodically in maintenance scripts
-- VACUUM;

-- =======================================================
-- INDEX USAGE MONITORING
-- =======================================================

-- Monitor index usage with this query:
-- SELECT name, sql FROM sqlite_master WHERE type='index' AND tbl_name='your_table';

-- Check query execution plan:
-- EXPLAIN QUERY PLAN SELECT * FROM your_table WHERE your_condition;