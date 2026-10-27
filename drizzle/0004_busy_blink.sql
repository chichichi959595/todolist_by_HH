ALTER TABLE `categories` ADD `course_id` integer REFERENCES courses(id) ON DELETE SET NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `categories_course_idx` ON `categories` (`course_id`);