import {
  boolean,
  date,
  decimal,
  index,
  integer,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

export const userRole = pgEnum("user_role", ["user", "admin"]);
export const itemType = pgEnum("item_type", ["production", "packaging", "sales"]);
export const displayUnit = pgEnum("display_unit", ["g", "pcs"]);
export const purchaseUnit = pgEnum("purchase_unit", ["g", "kg", "viss", "pcs"]);
export const purchaseStatus = pgEnum("purchase_status", ["draft", "confirmed"]);
export const operationType = pgEnum("operation_type", ["production", "packaging"]);

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: userRole("role").default("user").notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn", { withTimezone: true }).defaultNow().notNull(),
});

export const items = pgTable("items", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 180 }).notNull(),
  code: varchar("code", { length: 64 }),
  category: varchar("category", { length: 100 }),
  itemType: itemType("itemType").notNull(),
  displayUnit: displayUnit("displayUnit").notNull(),
  gramsPerDisplayUnit: decimal("gramsPerDisplayUnit", { precision: 18, scale: 6 }).notNull().default("1"),
  minStockGrams: decimal("minStockGrams", { precision: 18, scale: 6 }).notNull().default("0"),
  costPerUnit: decimal("costPerUnit", { precision: 18, scale: 4 }),
  effectiveFrom: date("effectiveFrom", { mode: "date" }).notNull(),
  inactiveFrom: date("inactiveFrom", { mode: "date" }),
  sortOrder: integer("sortOrder").notNull().default(0),
  createdBy: integer("createdBy").references(() => users.id),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
}, table => [
  uniqueIndex("items_code_unique").on(table.code),
  index("items_type_order_idx").on(table.itemType, table.sortOrder),
  index("items_effective_idx").on(table.effectiveFrom, table.inactiveFrom),
]);

export const purchases = pgTable("purchases", {
  id: serial("id").primaryKey(),
  purchaseDate: date("purchaseDate", { mode: "date" }).notNull(),
  itemId: integer("itemId").notNull().references(() => items.id),
  inputQuantity: decimal("inputQuantity", { precision: 18, scale: 6 }).notNull(),
  inputUnit: purchaseUnit("inputUnit").notNull(),
  quantityGrams: decimal("quantityGrams", { precision: 18, scale: 6 }).notNull(),
  totalCost: decimal("totalCost", { precision: 18, scale: 2 }).notNull(),
  unitCostPerGram: decimal("unitCostPerGram", { precision: 18, scale: 8 }).notNull(),
  status: purchaseStatus("status").notNull().default("confirmed"),
  confirmedAt: timestamp("confirmedAt", { withTimezone: true }),
  note: text("note"),
  createdBy: integer("createdBy").references(() => users.id),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
}, table => [
  index("purchases_date_item_idx").on(table.purchaseDate, table.itemId),
  index("purchases_item_month_idx").on(table.itemId, table.purchaseDate),
]);

export const operations = pgTable("operations", {
  id: serial("id").primaryKey(),
  operationDate: date("operationDate", { mode: "date" }).notNull(),
  itemId: integer("itemId").notNull().references(() => items.id),
  operationType: operationType("operationType").notNull(),
  issuedQtyGrams: decimal("issuedQtyGrams", { precision: 18, scale: 6 }).notNull().default("0"),
  issuedOverrideQtyGrams: decimal("issuedOverrideQtyGrams", { precision: 18, scale: 6 }),
  returnQtyGrams: decimal("returnQtyGrams", { precision: 18, scale: 6 }).notNull().default("0"),
  damageQtyGrams: decimal("damageQtyGrams", { precision: 18, scale: 6 }).notNull().default("0"),
  inOverrideQtyGrams: decimal("inOverrideQtyGrams", { precision: 18, scale: 6 }),
  openingOverrideQtyGrams: decimal("openingOverrideQtyGrams", { precision: 18, scale: 6 }),
  openingReason: text("openingReason"),
  note: text("note"),
  createdBy: integer("createdBy").references(() => users.id),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
}, table => [
  uniqueIndex("operations_date_item_type_unique").on(table.operationDate, table.itemId, table.operationType),
  index("operations_item_date_idx").on(table.itemId, table.operationDate),
]);

export const shops = pgTable("shops", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 180 }).notNull().unique(),
  active: boolean("active").notNull().default(true),
  createdBy: integer("createdBy").references(() => users.id),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
});

export const shopItemPrices = pgTable("shopItemPrices", {
  id: serial("id").primaryKey(),
  shopId: integer("shopId").notNull().references(() => shops.id),
  itemId: integer("itemId").notNull().references(() => items.id),
  sellingPricePerUnit: decimal("sellingPricePerUnit", { precision: 18, scale: 2 }).notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
}, table => [uniqueIndex("shop_item_price_unique").on(table.shopId, table.itemId)]);

export const salesEntries = pgTable("salesEntries", {
  id: serial("id").primaryKey(),
  saleDate: date("saleDate", { mode: "date" }).notNull(),
  shopId: integer("shopId").notNull().references(() => shops.id),
  itemId: integer("itemId").notNull().references(() => items.id),
  produceQtyGrams: decimal("produceQtyGrams", { precision: 18, scale: 6 }).notNull().default("0"),
  sellQtyGrams: decimal("sellQtyGrams", { precision: 18, scale: 6 }).notNull().default("0"),
  sellingPricePerUnit: decimal("sellingPricePerUnit", { precision: 18, scale: 2 }).notNull().default("0"),
  openingOverrideQtyGrams: decimal("openingOverrideQtyGrams", { precision: 18, scale: 6 }),
  openingReason: text("openingReason"),
  note: text("note"),
  createdBy: integer("createdBy").references(() => users.id),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
}, table => [
  uniqueIndex("sales_date_shop_item_unique").on(table.saleDate, table.shopId, table.itemId),
  index("sales_item_date_idx").on(table.itemId, table.saleDate),
]);

export const dailyLocks = pgTable("dailyLocks", {
  id: serial("id").primaryKey(),
  businessDate: date("businessDate", { mode: "date" }).notNull(),
  ledgerType: varchar("ledgerType", { length: 32 }).notNull(),
  locked: boolean("locked").notNull().default(false),
  lockedBy: integer("lockedBy").references(() => users.id),
  lockedAt: timestamp("lockedAt", { withTimezone: true }),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
}, table => [uniqueIndex("daily_locks_date_type_unique").on(table.businessDate, table.ledgerType)]);

export const auditLogs = pgTable("auditLogs", {
  id: serial("id").primaryKey(),
  action: varchar("action", { length: 80 }).notNull(),
  entityType: varchar("entityType", { length: 80 }).notNull(),
  entityId: integer("entityId"),
  businessDate: date("businessDate", { mode: "date" }),
  details: text("details"),
  createdBy: integer("createdBy").references(() => users.id),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
}, table => [index("audit_logs_date_idx").on(table.businessDate, table.createdAt)]);

export const recipes = pgTable("recipes", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 180 }).notNull(),
  outputItemId: integer("outputItemId").references(() => items.id),
  outputQuantityGrams: decimal("outputQuantityGrams", { precision: 18, scale: 6 }).notNull().default("1"),
  note: text("note"),
  active: boolean("active").notNull().default(true),
  createdBy: integer("createdBy").references(() => users.id),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
  effectiveFrom: date("effectiveFrom", { mode: "date" }).notNull().default(new Date("1970-01-01T00:00:00.000Z")),
});

export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  orderDate: date("orderDate", { mode: "date" }).notNull(),
  salesItemId: integer("salesItemId").notNull().references(() => items.id),
  quantity: decimal("quantity", { precision: 18, scale: 6 }).notNull().default("0"),
  note: text("note"),
  createdBy: integer("createdBy").references(() => users.id),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
}, table => [
  uniqueIndex("orders_date_sales_item_unique").on(table.orderDate, table.salesItemId),
  index("orders_date_idx").on(table.orderDate),
]);

export const recipeLines = pgTable("recipeLines", {
  id: serial("id").primaryKey(),
  recipeId: integer("recipeId").notNull().references(() => recipes.id, { onDelete: "cascade" }),
  itemId: integer("itemId").notNull().references(() => items.id),
  quantityGrams: decimal("quantityGrams", { precision: 18, scale: 6 }).notNull(),
}, table => [index("recipe_lines_recipe_idx").on(table.recipeId)]);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Item = typeof items.$inferSelect;
export type Purchase = typeof purchases.$inferSelect;
export type Operation = typeof operations.$inferSelect;
export type SalesEntry = typeof salesEntries.$inferSelect;

export const inventoryEnums = { userRole, itemType, displayUnit, purchaseUnit, purchaseStatus, operationType };
