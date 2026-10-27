CREATE TABLE `categories` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`color` text DEFAULT '#6366f1' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
--> statement-breakpoint
ALTER TABLE `tasks` ADD `category_id` integer REFERENCES categories(id) ON DELETE SET NULL;--> statement-breakpoint
CREATE INDEX `tasks_category_idx` ON `tasks` (`category_id`);