ALTER TABLE `purchases` ADD `status` enum('draft','confirmed') DEFAULT 'confirmed' NOT NULL;--> statement-breakpoint
ALTER TABLE `purchases` ADD `confirmedAt` timestamp;