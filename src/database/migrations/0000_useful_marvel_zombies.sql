CREATE TABLE `api_keys` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`key_name` text NOT NULL,
	`api_key` text NOT NULL,
	`last_used_at` text,
	`is_active` integer DEFAULT true,
	`rate_limit` integer DEFAULT 100,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP),
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `api_keys_api_key_unique` ON `api_keys` (`api_key`);--> statement-breakpoint
CREATE TABLE `contact_lists` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`total_contacts` integer DEFAULT 0,
	`valid_contacts` integer DEFAULT 0,
	`invalid_contacts` integer DEFAULT 0,
	`risky_contacts` integer DEFAULT 0,
	`unknown_contacts` integer DEFAULT 0,
	`last_validated_at` text,
	`tags` text,
	`is_active` integer DEFAULT true,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP),
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `contacts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`contact_list_id` integer NOT NULL,
	`email` text NOT NULL,
	`first_name` text,
	`last_name` text,
	`phone` text,
	`company` text,
	`custom_fields` text,
	`validation_status` text DEFAULT 'pending',
	`validation_result` text,
	`validation_score` real,
	`last_validated_at` text,
	`tags` text,
	`notes` text,
	`is_subscribed` integer DEFAULT true,
	`bounced_at` text,
	`unsubscribed_at` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP),
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP),
	FOREIGN KEY (`contact_list_id`) REFERENCES `contact_lists`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `plan_features` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`plan_id` integer NOT NULL,
	`feature_name` text NOT NULL,
	`feature_value` text,
	`is_enabled` integer DEFAULT true,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP),
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP),
	FOREIGN KEY (`plan_id`) REFERENCES `plans`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `plans` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`price` real NOT NULL,
	`billing_cycle` text NOT NULL,
	`validations_per_month` integer NOT NULL,
	`max_api_keys` integer DEFAULT 1,
	`max_contact_lists` integer DEFAULT 1,
	`bulk_validation` integer DEFAULT false,
	`api_access` integer DEFAULT true,
	`priority_support` integer DEFAULT false,
	`is_active` integer DEFAULT true,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP),
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP)
);
--> statement-breakpoint
CREATE TABLE `usage_quotas` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`plan_id` integer NOT NULL,
	`current_period_start` text NOT NULL,
	`current_period_end` text NOT NULL,
	`validations_used` integer DEFAULT 0,
	`validations_limit` integer NOT NULL,
	`api_calls_used` integer DEFAULT 0,
	`api_calls_limit` integer DEFAULT -1,
	`last_reset_at` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP),
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`plan_id`) REFERENCES `plans`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `user_subscriptions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`plan_id` integer NOT NULL,
	`status` text DEFAULT 'pending',
	`current_period_start` text,
	`current_period_end` text,
	`cancel_at_period_end` integer DEFAULT false,
	`stripe_subscription_id` text,
	`stripe_customer_id` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP),
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`plan_id`) REFERENCES `plans`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL,
	`password` text NOT NULL,
	`name` text NOT NULL,
	`is_active` integer DEFAULT true,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP),
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE TABLE `validation_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`api_key_id` integer,
	`email_validated` text NOT NULL,
	`validation_result` text NOT NULL,
	`processing_time_ms` integer,
	`ip_address` text,
	`user_agent` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP),
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`api_key_id`) REFERENCES `api_keys`(`id`) ON UPDATE no action ON DELETE no action
);
