CREATE TABLE `items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(180) NOT NULL,
	`code` varchar(64),
	`itemType` enum('production','packaging','sales') NOT NULL,
	`displayUnit` enum('g','pcs') NOT NULL,
	`gramsPerDisplayUnit` decimal(18,6) NOT NULL DEFAULT '1',
	`minStockGrams` decimal(18,6) NOT NULL DEFAULT '0',
	`costPerUnit` decimal(18,4),
	`effectiveFrom` date NOT NULL,
	`inactiveFrom` date,
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `items_id` PRIMARY KEY(`id`),
	CONSTRAINT `items_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `operations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`operationDate` date NOT NULL,
	`itemId` int NOT NULL,
	`operationType` enum('production','packaging') NOT NULL,
	`issuedQtyGrams` decimal(18,6) NOT NULL DEFAULT '0',
	`returnQtyGrams` decimal(18,6) NOT NULL DEFAULT '0',
	`damageQtyGrams` decimal(18,6) NOT NULL DEFAULT '0',
	`note` text,
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `operations_id` PRIMARY KEY(`id`),
	CONSTRAINT `operations_date_item_type_unique` UNIQUE(`operationDate`,`itemId`,`operationType`)
);
--> statement-breakpoint
CREATE TABLE `purchases` (
	`id` int AUTO_INCREMENT NOT NULL,
	`purchaseDate` date NOT NULL,
	`itemId` int NOT NULL,
	`inputQuantity` decimal(18,6) NOT NULL,
	`inputUnit` enum('g','kg','viss','pcs') NOT NULL,
	`quantityGrams` decimal(18,6) NOT NULL,
	`totalCost` decimal(18,2) NOT NULL,
	`unitCostPerGram` decimal(18,8) NOT NULL,
	`note` text,
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `purchases_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `recipeLines` (
	`id` int AUTO_INCREMENT NOT NULL,
	`recipeId` int NOT NULL,
	`itemId` int NOT NULL,
	`quantityGrams` decimal(18,6) NOT NULL,
	CONSTRAINT `recipeLines_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `recipes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(180) NOT NULL,
	`outputItemId` int,
	`outputQuantityGrams` decimal(18,6) NOT NULL DEFAULT '1',
	`note` text,
	`active` boolean NOT NULL DEFAULT true,
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `recipes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `salesEntries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`saleDate` date NOT NULL,
	`shopId` int NOT NULL,
	`itemId` int NOT NULL,
	`produceQtyGrams` decimal(18,6) NOT NULL DEFAULT '0',
	`sellQtyGrams` decimal(18,6) NOT NULL DEFAULT '0',
	`sellingPricePerUnit` decimal(18,2) NOT NULL DEFAULT '0',
	`note` text,
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `salesEntries_id` PRIMARY KEY(`id`),
	CONSTRAINT `sales_date_shop_item_unique` UNIQUE(`saleDate`,`shopId`,`itemId`)
);
--> statement-breakpoint
CREATE TABLE `shopItemPrices` (
	`id` int AUTO_INCREMENT NOT NULL,
	`shopId` int NOT NULL,
	`itemId` int NOT NULL,
	`sellingPricePerUnit` decimal(18,2) NOT NULL,
	`active` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `shopItemPrices_id` PRIMARY KEY(`id`),
	CONSTRAINT `shop_item_price_unique` UNIQUE(`shopId`,`itemId`)
);
--> statement-breakpoint
CREATE TABLE `shops` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(180) NOT NULL,
	`active` boolean NOT NULL DEFAULT true,
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `shops_id` PRIMARY KEY(`id`),
	CONSTRAINT `shops_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
ALTER TABLE `items` ADD CONSTRAINT `items_createdBy_users_id_fk` FOREIGN KEY (`createdBy`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `operations` ADD CONSTRAINT `operations_itemId_items_id_fk` FOREIGN KEY (`itemId`) REFERENCES `items`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `operations` ADD CONSTRAINT `operations_createdBy_users_id_fk` FOREIGN KEY (`createdBy`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `purchases` ADD CONSTRAINT `purchases_itemId_items_id_fk` FOREIGN KEY (`itemId`) REFERENCES `items`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `purchases` ADD CONSTRAINT `purchases_createdBy_users_id_fk` FOREIGN KEY (`createdBy`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `recipeLines` ADD CONSTRAINT `recipeLines_recipeId_recipes_id_fk` FOREIGN KEY (`recipeId`) REFERENCES `recipes`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `recipeLines` ADD CONSTRAINT `recipeLines_itemId_items_id_fk` FOREIGN KEY (`itemId`) REFERENCES `items`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `recipes` ADD CONSTRAINT `recipes_outputItemId_items_id_fk` FOREIGN KEY (`outputItemId`) REFERENCES `items`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `recipes` ADD CONSTRAINT `recipes_createdBy_users_id_fk` FOREIGN KEY (`createdBy`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `salesEntries` ADD CONSTRAINT `salesEntries_shopId_shops_id_fk` FOREIGN KEY (`shopId`) REFERENCES `shops`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `salesEntries` ADD CONSTRAINT `salesEntries_itemId_items_id_fk` FOREIGN KEY (`itemId`) REFERENCES `items`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `salesEntries` ADD CONSTRAINT `salesEntries_createdBy_users_id_fk` FOREIGN KEY (`createdBy`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `shopItemPrices` ADD CONSTRAINT `shopItemPrices_shopId_shops_id_fk` FOREIGN KEY (`shopId`) REFERENCES `shops`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `shopItemPrices` ADD CONSTRAINT `shopItemPrices_itemId_items_id_fk` FOREIGN KEY (`itemId`) REFERENCES `items`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `shops` ADD CONSTRAINT `shops_createdBy_users_id_fk` FOREIGN KEY (`createdBy`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `items_type_order_idx` ON `items` (`itemType`,`sortOrder`);--> statement-breakpoint
CREATE INDEX `items_effective_idx` ON `items` (`effectiveFrom`,`inactiveFrom`);--> statement-breakpoint
CREATE INDEX `operations_item_date_idx` ON `operations` (`itemId`,`operationDate`);--> statement-breakpoint
CREATE INDEX `purchases_date_item_idx` ON `purchases` (`purchaseDate`,`itemId`);--> statement-breakpoint
CREATE INDEX `purchases_item_month_idx` ON `purchases` (`itemId`,`purchaseDate`);--> statement-breakpoint
CREATE INDEX `recipe_lines_recipe_idx` ON `recipeLines` (`recipeId`);--> statement-breakpoint
CREATE INDEX `sales_item_date_idx` ON `salesEntries` (`itemId`,`saleDate`);