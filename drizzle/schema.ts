import {
  boolean,
  date,
  decimal,
  index,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const items = mysqlTable(
  "items",
  {
    id: int("id").autoincrement().primaryKey(),
    name: varchar("name", { length: 180 }).notNull(),
    code: varchar("code", { length: 64 }),
    category: varchar("category", { length: 100 }),
    itemType: mysqlEnum("itemType", ["production", "packaging", "sales"]).notNull(),
    displayUnit: mysqlEnum("displayUnit", ["g", "pcs"]).notNull(),
    gramsPerDisplayUnit: decimal("gramsPerDisplayUnit", { precision: 18, scale: 6 })
      .notNull()
      .default("1"),
    minStockGrams: decimal("minStockGrams", { precision: 18, scale: 6 })
      .notNull()
      .default("0"),
    costPerUnit: decimal("costPerUnit", { precision: 18, scale: 4 }),
    effectiveFrom: date("effectiveFrom").notNull(),
    inactiveFrom: date("inactiveFrom"),
    sortOrder: int("sortOrder").notNull().default(0),
    createdBy: int("createdBy").references(() => users.id),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("items_code_unique").on(table.code),
    index("items_type_order_idx").on(table.itemType, table.sortOrder),
    index("items_effective_idx").on(table.effectiveFrom, table.inactiveFrom),
  ],
);

export const purchases = mysqlTable(
  "purchases",
  {
    id: int("id").autoincrement().primaryKey(),
    purchaseDate: date("purchaseDate").notNull(),
    itemId: int("itemId")
      .notNull()
      .references(() => items.id),
    inputQuantity: decimal("inputQuantity", { precision: 18, scale: 6 }).notNull(),
    inputUnit: mysqlEnum("inputUnit", ["g", "kg", "viss", "pcs"]).notNull(),
    quantityGrams: decimal("quantityGrams", { precision: 18, scale: 6 }).notNull(),
    totalCost: decimal("totalCost", { precision: 18, scale: 2 }).notNull(),
    unitCostPerGram: decimal("unitCostPerGram", { precision: 18, scale: 8 }).notNull(),
    note: text("note"),
    createdBy: int("createdBy").references(() => users.id),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    index("purchases_date_item_idx").on(table.purchaseDate, table.itemId),
    index("purchases_item_month_idx").on(table.itemId, table.purchaseDate),
  ],
);

export const operations = mysqlTable(
  "operations",
  {
    id: int("id").autoincrement().primaryKey(),
    operationDate: date("operationDate").notNull(),
    itemId: int("itemId")
      .notNull()
      .references(() => items.id),
    operationType: mysqlEnum("operationType", ["production", "packaging"]).notNull(),
    issuedQtyGrams: decimal("issuedQtyGrams", { precision: 18, scale: 6 }).notNull().default("0"),
    returnQtyGrams: decimal("returnQtyGrams", { precision: 18, scale: 6 }).notNull().default("0"),
    damageQtyGrams: decimal("damageQtyGrams", { precision: 18, scale: 6 }).notNull().default("0"),
    note: text("note"),
    createdBy: int("createdBy").references(() => users.id),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("operations_date_item_type_unique").on(
      table.operationDate,
      table.itemId,
      table.operationType,
    ),
    index("operations_item_date_idx").on(table.itemId, table.operationDate),
  ],
);

export const shops = mysqlTable("shops", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 180 }).notNull().unique(),
  active: boolean("active").notNull().default(true),
  createdBy: int("createdBy").references(() => users.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const shopItemPrices = mysqlTable(
  "shopItemPrices",
  {
    id: int("id").autoincrement().primaryKey(),
    shopId: int("shopId")
      .notNull()
      .references(() => shops.id),
    itemId: int("itemId")
      .notNull()
      .references(() => items.id),
    sellingPricePerUnit: decimal("sellingPricePerUnit", { precision: 18, scale: 2 }).notNull(),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [uniqueIndex("shop_item_price_unique").on(table.shopId, table.itemId)],
);

export const salesEntries = mysqlTable(
  "salesEntries",
  {
    id: int("id").autoincrement().primaryKey(),
    saleDate: date("saleDate").notNull(),
    shopId: int("shopId")
      .notNull()
      .references(() => shops.id),
    itemId: int("itemId")
      .notNull()
      .references(() => items.id),
    produceQtyGrams: decimal("produceQtyGrams", { precision: 18, scale: 6 }).notNull().default("0"),
    sellQtyGrams: decimal("sellQtyGrams", { precision: 18, scale: 6 }).notNull().default("0"),
    sellingPricePerUnit: decimal("sellingPricePerUnit", { precision: 18, scale: 2 }).notNull().default("0"),
    note: text("note"),
    createdBy: int("createdBy").references(() => users.id),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("sales_date_shop_item_unique").on(table.saleDate, table.shopId, table.itemId),
    index("sales_item_date_idx").on(table.itemId, table.saleDate),
  ],
);

export const recipes = mysqlTable("recipes", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 180 }).notNull(),
  outputItemId: int("outputItemId").references(() => items.id),
  outputQuantityGrams: decimal("outputQuantityGrams", { precision: 18, scale: 6 })
    .notNull()
    .default("1"),
  note: text("note"),
  active: boolean("active").notNull().default(true),
  createdBy: int("createdBy").references(() => users.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const recipeLines = mysqlTable(
  "recipeLines",
  {
    id: int("id").autoincrement().primaryKey(),
    recipeId: int("recipeId")
      .notNull()
      .references(() => recipes.id, { onDelete: "cascade" }),
    itemId: int("itemId")
      .notNull()
      .references(() => items.id),
    quantityGrams: decimal("quantityGrams", { precision: 18, scale: 6 }).notNull(),
  },
  table => [index("recipe_lines_recipe_idx").on(table.recipeId)],
);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Item = typeof items.$inferSelect;
export type Purchase = typeof purchases.$inferSelect;
export type Operation = typeof operations.$inferSelect;
export type SalesEntry = typeof salesEntries.$inferSelect;
