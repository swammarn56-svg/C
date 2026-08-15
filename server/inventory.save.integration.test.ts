import { afterEach, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { appRouter } from "./routers";
import { requireDb } from "./db";
import { auditLogs, items, operations, purchases, users } from "../drizzle/schema";

describe.skipIf(!process.env.SUPABASE_DB_URL)("inventory operation save integration", () => {
  let testUserId: number | null = null;
  let testItemId: number | null = null;

  afterEach(async () => {
    const db = await requireDb();
    if (testUserId !== null) {
      await db.update(auditLogs).set({ createdBy: null }).where(eq(auditLogs.createdBy, testUserId));
      await db.delete(auditLogs).where(eq(auditLogs.createdBy, testUserId));
    }
    if (testItemId !== null) {
      await db.delete(operations).where(eq(operations.itemId, testItemId));
      await db.delete(purchases).where(eq(purchases.itemId, testItemId));
      await db.delete(items).where(eq(items.id, testItemId));
    }
    if (testUserId !== null) await db.delete(users).where(eq(users.id, testUserId));
    testUserId = null;
    testItemId = null;
  });

  it("clears a persisted manual In override and restores downstream purchase carryforward", async () => {
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

    await db.insert(purchases).values({
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
    });

    const caller = appRouter.createCaller({ req: {} as never, res: {} as never, user });
    const base = { itemId: item.id, type: "production" as const, issuedQtyGrams: 0, returnQtyGrams: 0, damageQtyGrams: 0 };

    await caller.inventory.operations.save({ ...base, date: "2099-01-01", inOverrideQtyGrams: 800 });
    await caller.inventory.operations.save({ ...base, date: "2099-01-02" });
    const overriddenNextDayRows = await caller.inventory.operations.daily({ date: "2099-01-02", type: "production" });
    const overriddenNextDay = overriddenNextDayRows.find(row => row.item.id === item.id)!;
    expect(overriddenNextDay.inQtyGrams).toBe(0);
    expect(overriddenNextDay.openingQtyGrams).toBe(800);

    await caller.inventory.operations.save({ ...base, date: "2099-01-01", inOverrideQtyGrams: null });
    const resetTodayRows = await caller.inventory.operations.daily({ date: "2099-01-01", type: "production" });
    const resetNextDayRows = await caller.inventory.operations.daily({ date: "2099-01-02", type: "production" });
    const resetToday = resetTodayRows.find(row => row.item.id === item.id)!;
    const resetNextDay = resetNextDayRows.find(row => row.item.id === item.id)!;
    expect(resetToday.inOverrideQtyGrams).toBeNull();
    expect(resetToday.inQtyGrams).toBe(500);
    expect(resetToday.closingQtyGrams).toBe(500);
    expect(resetNextDay.openingQtyGrams).toBe(500);
  }, 20000);
});
