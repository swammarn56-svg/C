import { afterEach, describe, expect, it } from "vitest";
import { and, eq, inArray } from "drizzle-orm";
import { appRouter } from "./routers";
import { requireDb } from "./db";
import { auditLogs, items, operations, orders, purchases, recipeLines, recipes, users } from "../drizzle/schema";

describe.skipIf(!process.env.SUPABASE_DB_URL)("inventory operation save integration", () => {
  let testUserId: number | null = null;
  let testItemId: number | null = null;
  let testSalesItemId: number | null = null;
  let testPackagingItemId: number | null = null;
  const testRecipeIds: number[] = [];

  afterEach(async () => {
    const db = await requireDb();
    if (testUserId !== null) {
      await db.update(auditLogs).set({ createdBy: null }).where(eq(auditLogs.createdBy, testUserId));
      await db.delete(auditLogs).where(eq(auditLogs.createdBy, testUserId));
    }
    if (testRecipeIds.length) {
      await db.delete(recipeLines).where(inArray(recipeLines.recipeId, testRecipeIds));
      await db.delete(recipes).where(inArray(recipes.id, testRecipeIds));
      testRecipeIds.length = 0;
    }
    if (testItemId !== null) {
      await db.delete(operations).where(eq(operations.itemId, testItemId));
      await db.delete(purchases).where(eq(purchases.itemId, testItemId));
      await db.delete(items).where(eq(items.id, testItemId));
    }
    if (testSalesItemId !== null) {
      await db.delete(orders).where(eq(orders.salesItemId, testSalesItemId));
      await db.delete(items).where(eq(items.id, testSalesItemId));
    }
    if (testPackagingItemId !== null) {
      await db.delete(operations).where(eq(operations.itemId, testPackagingItemId));
      await db.delete(items).where(eq(items.id, testPackagingItemId));
    }
    if (testUserId !== null) await db.delete(users).where(eq(users.id, testUserId));
    testUserId = null;
    testItemId = null;
    testSalesItemId = null;
    testPackagingItemId = null;
  });

  it("uses confirmed Purchase as the only In source and recalculates carryforward when cancelled", async () => {
    const db = await requireDb();
    const [user] = await db.insert(users).values({
      openId: `vitest-in-save-${Date.now()}`,
      name: "Inventory Save Test",
      email: "inventory-save-test@example.invalid",
      role: "admin",
    }).returning();
    testUserId = user.id;

    const [item] = await db.insert(items).values({
      name: `Integration Item ${Date.now()}`,
      itemType: "production",
      displayUnit: "g",
      gramsPerDisplayUnit: "1",
      minStockGrams: "0",
      effectiveFrom: new Date("2099-01-01T00:00:00.000Z"),
      sortOrder: 999999,
      createdBy: user.id,
    }).returning();
    testItemId = item.id;

    const [purchase] = await db.insert(purchases).values({
      purchaseDate: new Date("2099-01-01T00:00:00.000Z"),
      itemId: item.id,
      inputQuantity: "500",
      inputUnit: "g",
      quantityGrams: "500",
      totalCost: "50",
      unitCostPerGram: "0.1",
      status: "confirmed",
      confirmedAt: new Date(),
      createdBy: user.id,
    }).returning({ id: purchases.id });

    const caller = appRouter.createCaller({ req: {} as never, res: {} as never, user });
    const base = { itemId: item.id, type: "production" as const, issuedQtyGrams: 0, returnQtyGrams: 0, damageQtyGrams: 0 };

    await caller.inventory.operations.save({ ...base, date: "2099-01-01", inOverrideQtyGrams: 800 });
    await caller.inventory.operations.save({ ...base, date: "2099-01-02" });
    const purchaseTodayRows = await caller.inventory.operations.daily({ date: "2099-01-01", type: "production" });
    const purchaseNextDayRows = await caller.inventory.operations.daily({ date: "2099-01-02", type: "production" });
    const purchaseToday = purchaseTodayRows.find(row => row.item.id === item.id)!;
    const purchaseNextDay = purchaseNextDayRows.find(row => row.item.id === item.id)!;
    expect(purchaseToday.inOverrideQtyGrams).toBeNull();
    expect(purchaseToday.inQtyGrams).toBe(500);
    expect(purchaseToday.closingQtyGrams).toBe(500);
    expect(purchaseNextDay.openingQtyGrams).toBe(500);

    await caller.inventory.purchases.cancel({ id: purchase.id, reason: "Regression test cancellation" });
    const cancelledTodayRows = await caller.inventory.operations.daily({ date: "2099-01-01", type: "production" });
    const cancelledNextDayRows = await caller.inventory.operations.daily({ date: "2099-01-02", type: "production" });
    const cancelledToday = cancelledTodayRows.find(row => row.item.id === item.id)!;
    const cancelledNextDay = cancelledNextDayRows.find(row => row.item.id === item.id)!;
    expect(cancelledToday.inQtyGrams).toBe(0);
    expect(cancelledToday.closingQtyGrams).toBe(0);
    expect(cancelledNextDay.openingQtyGrams).toBe(0);
  }, 20000);

  it("accepts an Opening override without a reason and carries the balance forward", async () => {
    const db = await requireDb();
    const [user] = await db.insert(users).values({ openId: `vitest-opening-${Date.now()}`, name: "Opening Save Test", email: "opening-save-test@example.invalid", role: "admin" }).returning();
    testUserId = user.id;
    const [item] = await db.insert(items).values({ name: `Opening Item ${Date.now()}`, itemType: "production", displayUnit: "g", gramsPerDisplayUnit: "1", minStockGrams: "0", effectiveFrom: new Date("2099-01-01T00:00:00.000Z"), sortOrder: 999995, createdBy: user.id }).returning();
    testItemId = item.id;
    const caller = appRouter.createCaller({ req: {} as never, res: {} as never, user });
    await caller.inventory.operations.save({ date: "2099-01-01", itemId: item.id, type: "production", openingOverrideQtyGrams: 125, issuedQtyGrams: 25, returnQtyGrams: 0, damageQtyGrams: 0 });
    await caller.inventory.operations.save({ date: "2099-01-02", itemId: item.id, type: "production", issuedQtyGrams: 0, returnQtyGrams: 0, damageQtyGrams: 0 });
    const day1 = (await caller.inventory.operations.daily({ date: "2099-01-01", type: "production" })).find(row => row.item.id === item.id)!;
    const day2 = (await caller.inventory.operations.daily({ date: "2099-01-02", type: "production" })).find(row => row.item.id === item.id)!;
    expect(day1.openingReason).toBe("");
    expect(day1.closingQtyGrams).toBe(100);
    expect(day2.openingQtyGrams).toBe(100);
    await caller.inventory.operations.save({ date: "2099-01-01", itemId: item.id, type: "production", openingOverrideQtyGrams: 125, openingReason: "Stock count", issuedQtyGrams: 25, returnQtyGrams: 0, damageQtyGrams: 0 });
    const reasonSaved = (await caller.inventory.operations.daily({ date: "2099-01-01", type: "production" })).find(row => row.item.id === item.id)!;
    expect(reasonSaved.openingReason).toBe("Stock count");
  }, 20000);

  it("saves a Sale-item order, generates effective-date Issued quantities, and preserves manual Issued edits", async () => {
    const db = await requireDb();
    const [user] = await db.insert(users).values({ openId: `vitest-order-${Date.now()}`, name: "Order Save Test", email: "order-save-test@example.invalid", role: "admin" }).returning();
    testUserId = user.id;
    const [production] = await db.insert(items).values({ name: `Order Production ${Date.now()}`, itemType: "production", displayUnit: "g", gramsPerDisplayUnit: "1", minStockGrams: "0", effectiveFrom: new Date("2099-01-01T00:00:00.000Z"), sortOrder: 999998, createdBy: user.id }).returning();
    testItemId = production.id;
    const [packaging] = await db.insert(items).values({ name: `Order Packaging ${Date.now()}`, itemType: "packaging", displayUnit: "pcs", gramsPerDisplayUnit: "1", minStockGrams: "0", effectiveFrom: new Date("2099-01-01T00:00:00.000Z"), sortOrder: 999997, createdBy: user.id }).returning();
    testPackagingItemId = packaging.id;
    const [sales] = await db.insert(items).values({ name: `Order Sale ${Date.now()}`, itemType: "sales", displayUnit: "pcs", gramsPerDisplayUnit: "1", minStockGrams: "0", effectiveFrom: new Date("2099-01-01T00:00:00.000Z"), sortOrder: 999996, createdBy: user.id }).returning();
    testSalesItemId = sales.id;
    const [recipeDay1] = await db.insert(recipes).values({ name: `Order Recipe ${Date.now()}`, outputItemId: sales.id, outputQuantityGrams: "1", effectiveFrom: new Date("2099-01-01T00:00:00.000Z"), active: true, createdBy: user.id }).returning();
    const [recipeDay3] = await db.insert(recipes).values({ name: `Order Recipe v2 ${Date.now()}`, outputItemId: sales.id, outputQuantityGrams: "1", effectiveFrom: new Date("2099-01-03T00:00:00.000Z"), active: true, createdBy: user.id }).returning();
    testRecipeIds.push(recipeDay1.id, recipeDay3.id);
    await db.insert(recipeLines).values([{ recipeId: recipeDay1.id, itemId: production.id, quantityGrams: "100" }, { recipeId: recipeDay1.id, itemId: packaging.id, quantityGrams: "50" }, { recipeId: recipeDay3.id, itemId: production.id, quantityGrams: "200" }, { recipeId: recipeDay3.id, itemId: packaging.id, quantityGrams: "75" }]);
    const caller = appRouter.createCaller({ req: {} as never, res: {} as never, user });
    await caller.inventory.orders.save({ date: "2099-01-02", salesItemId: sales.id, quantity: 10, note: "Market order" });
    const day2Production = (await caller.inventory.operations.daily({ date: "2099-01-02", type: "production" })).find(row => row.item.id === production.id)!;
    const day2Packaging = (await caller.inventory.operations.daily({ date: "2099-01-02", type: "packaging" })).find(row => row.item.id === packaging.id)!;
    expect(day2Production.issuedQtyGrams).toBe(1000);
    expect(day2Packaging.issuedQtyGrams).toBe(500);
    await caller.inventory.operations.save({ date: "2099-01-02", itemId: production.id, type: "production", issuedQtyGrams: 999, issuedOverrideQtyGrams: 999, returnQtyGrams: 0, damageQtyGrams: 0 });
    const manualDay2 = (await caller.inventory.operations.daily({ date: "2099-01-02", type: "production" })).find(row => row.item.id === production.id)!;
    expect(manualDay2.issuedQtyGrams).toBe(999);
    await caller.inventory.orders.save({ date: "2099-01-03", salesItemId: sales.id, quantity: 10, note: "Updated recipe day" });
    const day3Production = (await caller.inventory.operations.daily({ date: "2099-01-03", type: "production" })).find(row => row.item.id === production.id)!;
    const priorDay2 = (await caller.inventory.operations.daily({ date: "2099-01-02", type: "production" })).find(row => row.item.id === production.id)!;
    expect(day3Production.issuedQtyGrams).toBe(2000);
    expect(priorDay2.issuedQtyGrams).toBe(999);
  }, 30000);
});
