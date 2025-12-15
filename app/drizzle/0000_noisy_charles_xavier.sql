CREATE TABLE `message` (
	`id` text PRIMARY KEY NOT NULL,
	`content` text NOT NULL,
	`sender` text NOT NULL,
	`timestamp` integer NOT NULL,
	`chat_id` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `message_chat_id_idx` ON `message` (`chat_id`);