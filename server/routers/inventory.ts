import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, gt, gte, ilike, inArray, isNull, lt, lte, or } from "drizzle-orm";
import { z } from "zod";
import {
  auditLogs,
  dailyLocks,
  items,
  operations,
  orders,
  purchases,
  recipeLines,
  recipes,
  salesEntries,
  shopItemPrices,
  shops,
  users,
} from "../../drizzle/schema";
import {
  calculateMonthlyAverageCost,
  calculateOperationBalance,
  calculateRecipeIssuedQuantity,
  resolveOperationIn,
  calculateSalesClosing,
  displayQuantity,
  isItemEffectiveOnDate,
  normalizePurchaseBaseQuantity,
  normalizePurchaseQuantity,
} from "../../shared/inventory";
import { requireDb } from "../db";
import { protectedProcedure, router } from "../_core/trpc";

const businessDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const itemType = z.enum(["production", "packaging", "sales"]);
const operationType = z.enum(["production", "packaging"]);
const purchaseUnit = z.enum(["g", "kg", "viss", "pcs"]);
const nonNegative = z.number().finite().min(0);
const positive = z.number().finite().positive();

const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Administrator access is required." });
  }
  return next();
});

const number = (value: unknown) => Number(value ?? 0);
const toDate = (value: Date | string) => (value instanceof Date ? value.toISOString().slice(0, 10) : String(value));
const dbDate = (value: string) => new Date(`${value}T00:00:00.000Z`);
const monthStart = (date: string) => `${date.slice(0, 7)}-01`;
const nextMonthStart = (date: string) => {
  const value = new Date(`${monthStart(date)}T00:00:00Z`);
  value.setUTCMonth(value.getUTCMonth() + 1);
  return value.toISOString().slice(0, 10);
};

function ensureEffective(item: { effectiveFrom: Date | string; inactiveFrom: Date | string | null }, date: string) {
  if (!isItemEffectiveOnDate(date, toDate(item.effectiveFrom), item.inactiveFrom ? toDate(item.inactiveFrom) : null)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "This item is not active for the selected business date." });
  }
}

async function assertDayOpen(date: string, ledgerType: string) {
  const db = await requireDb();
  const lock = await db.select({ locked: dailyLocks.locked }).from(dailyLocks).where(and(eq(dailyLocks.businessDate, dbDate(date)), eq(dailyLocks.ledgerType, ledgerType))).limit(1);
  if (lock[0]?.locked) throw new TRPCError({ code: "FORBIDDEN", message: `The ${ledgerType} ledger is locked for ${date}. An administrator must reopen it first.` });
}

async function recordAudit(ctx: { user: { id: number } }, action: string, entityType: string, entityId: number | null, businessDate: string | null, details: Record<string, unknown>) {
  const db = await requireDb();
  await db.insert(auditLogs).values({ action, entityType, entityId, businessDate: businessDate ? dbDate(businessDate) : null, details: JSON.stringify(details), createdBy: ctx.user.id });
}

function publicItem<T extends typeof items.$inferSelect>(item: T, includeSalesCost = false) {
  const { costPerUnit, ...safeItem } = item;
  return item.itemType === "sales" && includeSalesCost ? { ...safeItem, costPerUnit } : safeItem;
}

function generatedIssuedMap(orderRows: Array<typeof orders.$inferSelect>, recipeRows: Array<typeof recipes.$inferSelect>, lineRows: Array<typeof recipeLines.$inferSelect>, componentRows: Array<typeof items.$inferSelect>, type: "production" | "packaging") {
  const map = new Map<string, number>();
  const componentsById = new Map(componentRows.map(item => [item.id, item]));
  for (const order of orderRows) {
    const recipe = recipeRows.filter(candidate => candidate.active && candidate.outputItemId === order.salesItemId && toDate(candidate.effectiveFrom) <= toDate(order.orderDate)).sort((a, b) => toDate(b.effectiveFrom).localeCompare(toDate(a.effectiveFrom)))[0];
    if (!recipe || number(recipe.outputQuantityGrams) <= 0) continue;
    for (const line of lineRows.filter(candidate => candidate.recipeId === recipe.id)) {
      const component = componentsById.get(line.itemId);
      if (!component || component.itemType !== type) continue;
      const key = `${order.orderDate.toISOString().slice(0, 10)}|${line.itemId}`;
      map.set(key, (map.get(key) ?? 0) + calculateRecipeIssuedQuantity(number(order.quantity), number(recipe.outputQuantityGrams), number(line.quantityGrams)));
    }
  }
  return map;
}

async function operationLedgerForDate(date: string, type: "production" | "packaging") {
  const db = await requireDb();
  const activeItems = await db
    .select()
    .from(items)
    .where(and(eq(items.itemType, type), lte(items.effectiveFrom, dbDate(date)), or(isNull(items.inactiveFrom), gt(items.inactiveFrom, dbDate(date)))))
    .orderBy(asc(items.sortOrder), asc(items.name));
  const [allPurchases, allOperations, allOrders, recipeRows, lineRows, componentRows] = await Promise.all([
    db.select({ itemId: purchases.itemId, purchaseDate: purchases.purchaseDate, quantityGrams: purchases.quantityGrams })
      .from(purchases).innerJoin(items, eq(purchases.itemId, items.id))
      .where(and(eq(items.itemType, type), eq(purchases.status, "confirmed"), lte(purchases.purchaseDate, dbDate(date)))),
    db.select().from(operations).where(and(eq(operations.operationType, type), lte(operations.operationDate, dbDate(date)))),
    db.select().from(orders).where(lte(orders.orderDate, dbDate(date))),
    db.select().from(recipes),
    db.select().from(recipeLines),
    db.select().from(items),
  ]);
  const purchaseByKey = new Map<string, number>();
  allPurchases.forEach(row => {
    const key = `${row.itemId}|${toDate(row.purchaseDate)}`;
    purchaseByKey.set(key, (purchaseByKey.get(key) ?? 0) + number(row.quantityGrams));
  });
  const operationByKey = new Map<string, typeof allOperations[number]>();
  allOperations.forEach(row => operationByKey.set(`${row.itemId}|${toDate(row.operationDate)}`, row));
  const generatedByKey = generatedIssuedMap(allOrders, recipeRows, lineRows, componentRows, type);
  const dates = Array.from(new Set([
    date,
    ...allPurchases.map(row => toDate(row.purchaseDate)),
    ...allOperations.map(row => toDate(row.operationDate)),
    ...allOrders.map(row => toDate(row.orderDate)),
  ])).sort();

  return activeItems.map(item => {
    let opening = 0;
    let result: any = null;
    for (const currentDate of dates) {
      const saved = operationByKey.get(`${item.id}|${currentDate}`);
      if (saved?.openingOverrideQtyGrams !== null && saved?.openingOverrideQtyGrams !== undefined) opening = number(saved.openingOverrideQtyGrams);
      const amounts = {
        openingQtyGrams: opening,
        inQtyGrams: resolveOperationIn(purchaseByKey.get(`${item.id}|${currentDate}`) ?? 0, saved?.inOverrideQtyGrams === null || saved?.inOverrideQtyGrams === undefined ? null : number(saved.inOverrideQtyGrams)),
        issuedQtyGrams: saved?.issuedOverrideQtyGrams !== null && saved?.issuedOverrideQtyGrams !== undefined ? number(saved.issuedOverrideQtyGrams) : (generatedByKey.get(`${currentDate}|${item.id}`) ?? number(saved?.issuedQtyGrams)),
        returnQtyGrams: number(saved?.returnQtyGrams),
        damageQtyGrams: number(saved?.damageQtyGrams),
      };
      const calculated = calculateOperationBalance(amounts);
      if (currentDate === date) {
        result = { item: publicItem(item), operationId: saved?.id ?? null, date, issuedOverrideQtyGrams: saved?.issuedOverrideQtyGrams ?? null, inOverrideQtyGrams: saved?.inOverrideQtyGrams ?? null, purchaseInQtyGrams: purchaseByKey.get(`${item.id}|${currentDate}`) ?? 0, openingOverrideQtyGrams: saved?.openingOverrideQtyGrams ?? null, openingReason: saved?.openingReason ?? "", note: saved?.note ?? "", ...amounts, ...calculated };
      }
      opening = calculated.closingQtyGrams;
    }
    return result ?? { item: publicItem(item), operationId: null, date, inOverrideQtyGrams: null, purchaseInQtyGrams: 0, openingOverrideQtyGrams: null, openingReason: "", note: "", openingQtyGrams: 0, inQtyGrams: 0, issuedQtyGrams: 0, returnQtyGrams: 0, damageQtyGrams: 0, ...calculateOperationBalance({ openingQtyGrams: 0, inQtyGrams: 0, issuedQtyGrams: 0, returnQtyGrams: 0, damageQtyGrams: 0 }) };
  });
}

async function monthlyCostMap(monthDate: string) {
  const db = await requireDb();
  const entries = await db
    .select({ itemId: purchases.itemId, quantityGrams: purchases.quantityGrams, totalCost: purchases.totalCost })
    .from(purchases)
    .where(and(eq(purchases.status, "confirmed"), gte(purchases.purchaseDate, dbDate(monthStart(monthDate))), lt(purchases.purchaseDate, dbDate(nextMonthStart(monthDate)))));
  const grouped = new Map<number, Array<{ quantityGrams: number; totalCost: number }>>();
  entries.forEach(entry => {
    const group = grouped.get(entry.itemId) ?? [];
    group.push({ quantityGrams: number(entry.quantityGrams), totalCost: number(entry.totalCost) });
    grouped.set(entry.itemId, group);
  });
  return new Map(Array.from(grouped.entries()).map(([id, rows]) => [id, calculateMonthlyAverageCost(rows)]));
}

export const inventoryRouter = router({
  items: router({
    list: protectedProcedure
      .input(z.object({ date: businessDate.optional(), type: itemType.optional(), includeInactive: z.boolean().optional() }).optional())
      .query(async ({ input, ctx }) => {
        const db = await requireDb();
        const selectedDate = input?.date;
        const filters = [input?.type ? eq(items.itemType, input.type) : undefined];
        if (selectedDate) {
          filters.push(lte(items.effectiveFrom, dbDate(selectedDate)));
          if (!input?.includeInactive) filters.push(or(isNull(items.inactiveFrom), gt(items.inactiveFrom, dbDate(selectedDate))));
        }
        const result = await db
          .select()
          .from(items)
          .where(and(...filters.filter(Boolean) as []))
          .orderBy(asc(items.itemType), asc(items.sortOrder), asc(items.name));
        return result.map(item => publicItem(item, ctx.user.role === "admin"));
      }),
    create: adminProcedure
      .input(
        z.object({
          name: z.string().trim().min(1).max(180),
          code: z.string().trim().max(64).optional().nullable(),
          category: z.string().trim().max(100).optional().nullable(),
          itemType,
          displayUnit: z.enum(["g", "pcs"]),
          gramsPerDisplayUnit: positive,
          minStockGrams: nonNegative.default(0),
          costPerUnit: nonNegative.optional().nullable(),
          effectiveFrom: businessDate,
        }),
      )
      .mutation(async ({ input, ctx }) => {
        const db = await requireDb();
        const last = await db
          .select({ sortOrder: items.sortOrder })
          .from(items)
          .where(eq(items.itemType, input.itemType))
          .orderBy(desc(items.sortOrder))
          .limit(1);
        const values = {
          ...input,
          code: input.code || null,
          category: input.category || null,
          costPerUnit: input.itemType === "sales" ? input.costPerUnit?.toString() ?? null : null,
          gramsPerDisplayUnit: input.gramsPerDisplayUnit.toString(),
          minStockGrams: input.minStockGrams.toString(),
          effectiveFrom: dbDate(input.effectiveFrom),
          sortOrder: (last[0]?.sortOrder ?? -1) + 1,
          createdBy: ctx.user.id,
        };
        const result = await db.insert(items).values(values).returning({ id: items.id });
        return { id: result[0]!.id };
      }),
    update: adminProcedure
      .input(
        z.object({
          id: z.number().int().positive(),
          name: z.string().trim().min(1).max(180),
          code: z.string().trim().max(64).optional().nullable(),
          category: z.string().trim().max(100).optional().nullable(),
          minStockGrams: nonNegative,
          costPerUnit: nonNegative.optional().nullable(),
          effectiveFrom: businessDate,
          gramsPerDisplayUnit: positive,
        }),
      )
      .mutation(async ({ input }) => {
        const db = await requireDb();
        const existing = await db.select().from(items).where(eq(items.id, input.id)).limit(1);
        if (!existing[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Item not found." });
        await db
          .update(items)
          .set({
            name: input.name,
            code: input.code || null,
            category: input.category || null,
            minStockGrams: input.minStockGrams.toString(),
            costPerUnit: existing[0].itemType === "sales" ? input.costPerUnit?.toString() ?? null : null,
            effectiveFrom: dbDate(input.effectiveFrom),
            gramsPerDisplayUnit: input.gramsPerDisplayUnit.toString(),
          })
          .where(eq(items.id, input.id));
        return { success: true };
      }),
    deactivate: adminProcedure
      .input(z.object({ id: z.number().int().positive(), inactiveFrom: businessDate }))
      .mutation(async ({ input }) => {
        const db = await requireDb();
        const item = await db.select().from(items).where(eq(items.id, input.id)).limit(1);
        if (!item[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Item not found." });
        if (input.inactiveFrom < toDate(item[0].effectiveFrom)) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Deletion date cannot precede the item start date." });
        }
        await db.update(items).set({ inactiveFrom: dbDate(input.inactiveFrom) }).where(eq(items.id, input.id));
        return { success: true };
      }),
    reactivate: adminProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ input }) => {
        const db = await requireDb();
        await db.update(items).set({ inactiveFrom: null }).where(eq(items.id, input.id));
        return { success: true };
      }),
    reorder: adminProcedure
      .input(z.object({ type: itemType, ids: z.array(z.number().int().positive()).min(1) }))
      .mutation(async ({ input }) => {
        const db = await requireDb();
        const current = await db.select().from(items).where(and(eq(items.itemType, input.type), inArray(items.id, input.ids)));
        if (current.length !== input.ids.length) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "The submitted order does not match the item list." });
        }
        await Promise.all(input.ids.map((id, sortOrder) => db.update(items).set({ sortOrder }).where(eq(items.id, id))));
        return { success: true };
      }),
  }),

  purchases: router({
    list: protectedProcedure
      .input(z.object({ from: businessDate.optional(), to: businessDate.optional(), type: itemType.optional() }).optional())
      .query(async ({ input }) => {
        const db = await requireDb();
        const conditions = [input?.from ? gte(purchases.purchaseDate, dbDate(input.from)) : undefined, input?.to ? lte(purchases.purchaseDate, dbDate(input.to)) : undefined, input?.type ? eq(items.itemType, input.type) : undefined].filter(Boolean);
        const result = await db
          .select({ purchase: purchases, item: items })
          .from(purchases)
          .innerJoin(items, eq(purchases.itemId, items.id))
          .where(and(...conditions as []))
          .orderBy(desc(purchases.purchaseDate), desc(purchases.id));
        return result.map(row => ({ ...row.purchase, baseQuantity: row.purchase.quantityGrams, baseUnit: row.item.displayUnit, item: publicItem(row.item) }));
      }),
    create: protectedProcedure
      .input(
        z.object({
          purchaseDate: businessDate,
          itemId: z.number().int().positive(),
          inputQuantity: positive,
          inputUnit: purchaseUnit,
          totalCost: nonNegative,
          status: z.enum(["draft", "confirmed"]).default("confirmed"),
          note: z.string().trim().max(2000).optional().nullable(),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        const db = await requireDb();
        const item = await db.select().from(items).where(eq(items.id, input.itemId)).limit(1);
        if (!item[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Item not found." });
        ensureEffective(item[0], input.purchaseDate);
        if (item[0].displayUnit === "pcs" && input.inputUnit !== "pcs") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Piece-based items must be purchased in pcs and remain in pcs inventory." });
        }
        if (item[0].displayUnit === "g" && input.inputUnit === "pcs") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Weight-based items must use g, kg, or viss." });
        }
        const quantityGrams = normalizePurchaseBaseQuantity(input.inputQuantity, input.inputUnit, item[0].displayUnit);
        const unitCostPerGram = input.totalCost / quantityGrams;
        const result = await db.insert(purchases).values({
          purchaseDate: dbDate(input.purchaseDate),
          itemId: input.itemId,
          inputQuantity: input.inputQuantity.toString(),
          inputUnit: input.inputUnit,
          quantityGrams: quantityGrams.toString(),
          totalCost: input.totalCost.toFixed(2),
          unitCostPerGram: unitCostPerGram.toString(),
          status: input.status,
          confirmedAt: input.status === "confirmed" ? new Date() : null,
          note: input.note || null,
          createdBy: ctx.user.id,
        }).returning({ id: purchases.id });
        return { id: result[0]!.id, quantityGrams };
      }),
    confirm: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ input }) => {
        const db = await requireDb();
        await db.update(purchases).set({ status: "confirmed", confirmedAt: new Date() }).where(eq(purchases.id, input.id));
        return { success: true };
      }),
  }),

  operations: router({
    daily: protectedProcedure
      .input(z.object({ date: businessDate, type: operationType }))
      .query(({ input }) => operationLedgerForDate(input.date, input.type)),
    save: protectedProcedure
      .input(
        z.object({
          date: businessDate,
          itemId: z.number().int().positive(),
          type: operationType,
          issuedQtyGrams: nonNegative,
          returnQtyGrams: nonNegative,
          damageQtyGrams: nonNegative,
          issuedOverrideQtyGrams: nonNegative.optional().nullable(),
          inOverrideQtyGrams: nonNegative.optional().nullable(),
          openingOverrideQtyGrams: nonNegative.optional().nullable(),
          openingReason: z.string().trim().max(500).optional().nullable(),
          note: z.string().trim().max(2000).optional().nullable(),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        const db = await requireDb();
        await assertDayOpen(input.date, input.type);
        if (input.inOverrideQtyGrams !== undefined && ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Only administrators can manually override In." });
        if (input.openingOverrideQtyGrams !== null && input.openingOverrideQtyGrams !== undefined && !input.openingReason?.trim()) throw new TRPCError({ code: "BAD_REQUEST", message: "Opening edit reason is required." });
        const item = await db.select().from(items).where(eq(items.id, input.itemId)).limit(1);
        if (!item[0] || item[0].itemType !== input.type) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "The item does not belong to this ledger." });
        }
        ensureEffective(item[0], input.date);
        const existingOperation = await db.select().from(operations).where(and(eq(operations.operationDate, dbDate(input.date)), eq(operations.itemId, input.itemId), eq(operations.operationType, input.type))).limit(1);
        await db
          .insert(operations)
          .values({
            operationDate: dbDate(input.date),
            itemId: input.itemId,
            operationType: input.type,
            issuedQtyGrams: input.issuedQtyGrams.toString(),
            issuedOverrideQtyGrams: input.issuedOverrideQtyGrams === undefined ? existingOperation[0]?.issuedOverrideQtyGrams ?? null : input.issuedOverrideQtyGrams === null ? null : input.issuedOverrideQtyGrams.toString(),
            returnQtyGrams: input.returnQtyGrams.toString(),
            damageQtyGrams: input.damageQtyGrams.toString(),
            inOverrideQtyGrams: input.inOverrideQtyGrams === undefined ? existingOperation[0]?.inOverrideQtyGrams ?? null : input.inOverrideQtyGrams === null ? null : input.inOverrideQtyGrams.toString(),
            openingOverrideQtyGrams: input.openingOverrideQtyGrams === null || input.openingOverrideQtyGrams === undefined ? null : input.openingOverrideQtyGrams.toString(),
            openingReason: input.openingReason?.trim() || null,
            note: input.note || null,
            createdBy: ctx.user.id,
          })
          .onConflictDoUpdate({
            target: [operations.operationDate, operations.itemId, operations.operationType],
            set: {
              issuedQtyGrams: input.issuedQtyGrams.toString(),
              issuedOverrideQtyGrams: input.issuedOverrideQtyGrams === undefined ? existingOperation[0]?.issuedOverrideQtyGrams ?? null : input.issuedOverrideQtyGrams === null ? null : input.issuedOverrideQtyGrams.toString(),
              returnQtyGrams: input.returnQtyGrams.toString(),
              damageQtyGrams: input.damageQtyGrams.toString(),
              inOverrideQtyGrams: input.inOverrideQtyGrams === undefined ? existingOperation[0]?.inOverrideQtyGrams ?? null : input.inOverrideQtyGrams === null ? null : input.inOverrideQtyGrams.toString(),
              openingOverrideQtyGrams: input.openingOverrideQtyGrams === null || input.openingOverrideQtyGrams === undefined ? null : input.openingOverrideQtyGrams.toString(),
              openingReason: input.openingReason?.trim() || null,
              note: input.note || null,
              createdBy: ctx.user.id,
            },
          });
        const saved = await db.select({ id: operations.id }).from(operations).where(and(eq(operations.operationDate, dbDate(input.date)), eq(operations.itemId, input.itemId), eq(operations.operationType, input.type))).limit(1);
        await recordAudit(ctx, input.openingOverrideQtyGrams !== null && input.openingOverrideQtyGrams !== undefined ? "opening_override" : "operation_save", "operations", saved[0]?.id ?? null, input.date, { itemId: input.itemId, type: input.type, inOverrideQtyGrams: input.inOverrideQtyGrams ?? null, reason: input.openingReason ?? null });
        return { success: true };
      }),
  }),

  audit: router({
    list: adminProcedure
      .input(z.object({ from: businessDate.optional(), to: businessDate.optional(), action: z.string().trim().max(80).optional(), actor: z.string().trim().max(160).optional(), entity: z.string().trim().max(80).optional(), details: z.string().trim().max(160).optional(), limit: z.number().int().min(1).max(200).default(100) }).optional())
      .query(async ({ input }) => {
        const db = await requireDb();
        const filters = [
          input?.from ? gte(auditLogs.businessDate, dbDate(input.from)) : undefined,
          input?.to ? lte(auditLogs.businessDate, dbDate(input.to)) : undefined,
          input?.action ? eq(auditLogs.action, input.action) : undefined,
          input?.actor ? or(ilike(users.name, `%${input.actor}%`), ilike(users.email, `%${input.actor}%`)) : undefined,
          input?.entity ? ilike(auditLogs.entityType, `%${input.entity}%`) : undefined,
          input?.details ? ilike(auditLogs.details, `%${input.details}%`) : undefined,
        ].filter(Boolean) as any[];
        const rows = await db.select({ id: auditLogs.id, action: auditLogs.action, entityType: auditLogs.entityType, entityId: auditLogs.entityId, businessDate: auditLogs.businessDate, details: auditLogs.details, createdAt: auditLogs.createdAt, actorName: users.name, actorEmail: users.email }).from(auditLogs).leftJoin(users, eq(auditLogs.createdBy, users.id)).where(and(...filters)).orderBy(desc(auditLogs.createdAt)).limit(input?.limit ?? 100);
        return rows;
      }),
  }),

  search: protectedProcedure
    .input(z.object({ query: z.string().trim().min(1).max(120) }))
    .query(async ({ input }) => {
      const db = await requireDb();
      const term = `%${input.query}%`;
      const [itemRows, shopRows, recipeRows, purchaseRows, operationRows, saleRows] = await Promise.all([
        db.select({ id: items.id, name: items.name, code: items.code, category: items.category, effectiveFrom: items.effectiveFrom }).from(items).where(or(ilike(items.name, term), ilike(items.code, term), ilike(items.category, term))).orderBy(asc(items.name)).limit(30),
        db.select({ id: shops.id, name: shops.name }).from(shops).where(ilike(shops.name, term)).orderBy(asc(shops.name)).limit(20),
        db.select({ id: recipes.id, name: recipes.name, note: recipes.note }).from(recipes).where(or(ilike(recipes.name, term), ilike(recipes.note, term))).orderBy(asc(recipes.name)).limit(20),
        db.select({ id: purchases.id, itemId: purchases.itemId, purchaseDate: purchases.purchaseDate, note: purchases.note }).from(purchases).where(ilike(purchases.note, term)).orderBy(desc(purchases.purchaseDate)).limit(20),
        db.select({ id: operations.id, itemId: operations.itemId, operationDate: operations.operationDate, operationType: operations.operationType, note: operations.note }).from(operations).where(ilike(operations.note, term)).orderBy(desc(operations.operationDate)).limit(20),
        db.select({ id: salesEntries.id, itemId: salesEntries.itemId, shopId: salesEntries.shopId, saleDate: salesEntries.saleDate, note: salesEntries.note }).from(salesEntries).where(ilike(salesEntries.note, term)).orderBy(desc(salesEntries.saleDate)).limit(20),
      ]);
      return { items: itemRows, shops: shopRows, recipes: recipeRows, records: [...purchaseRows.map(row => ({ ...row, kind: "Purchase" as const, date: row.purchaseDate })), ...operationRows.map(row => ({ ...row, kind: `${row.operationType} operation`, date: row.operationDate })), ...saleRows.map(row => ({ ...row, kind: "Sale" as const, date: row.saleDate }))].sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 40) };
    }),

  daily: router({
    status: protectedProcedure.input(z.object({ date: businessDate, ledgerType: z.enum(["production", "packaging", "sales"]) })).query(async ({ input }) => {
      const db = await requireDb();
      const row = await db.select().from(dailyLocks).where(and(eq(dailyLocks.businessDate, dbDate(input.date)), eq(dailyLocks.ledgerType, input.ledgerType))).limit(1);
      return row[0] ?? { locked: false, businessDate: dbDate(input.date), ledgerType: input.ledgerType };
    }),
    lock: adminProcedure.input(z.object({ date: businessDate, ledgerType: z.enum(["production", "packaging", "sales"]) })).mutation(async ({ input, ctx }) => {
      const db = await requireDb();
      await db.insert(dailyLocks).values({ businessDate: dbDate(input.date), ledgerType: input.ledgerType, locked: true, lockedBy: ctx.user.id, lockedAt: new Date() }).onConflictDoUpdate({ target: [dailyLocks.businessDate, dailyLocks.ledgerType], set: { locked: true, lockedBy: ctx.user.id, lockedAt: new Date() } });
      await recordAudit(ctx, "daily_lock", "dailyLocks", null, input.date, { ledgerType: input.ledgerType });
      return { success: true };
    }),
    reopen: adminProcedure.input(z.object({ date: businessDate, ledgerType: z.enum(["production", "packaging", "sales"]) })).mutation(async ({ input, ctx }) => {
      const db = await requireDb();
      await db.update(dailyLocks).set({ locked: false, lockedBy: null, lockedAt: null }).where(and(eq(dailyLocks.businessDate, dbDate(input.date)), eq(dailyLocks.ledgerType, input.ledgerType)));
      await recordAudit(ctx, "daily_reopen", "dailyLocks", null, input.date, { ledgerType: input.ledgerType });
      return { success: true };
    }),
  }),

  shops: router({
    list: protectedProcedure.query(async () => {
      const db = await requireDb();
      return db.select().from(shops).orderBy(asc(shops.name));
    }),
    save: adminProcedure
      .input(z.object({ id: z.number().int().positive().optional(), name: z.string().trim().min(1).max(180), active: z.boolean().default(true) }))
      .mutation(async ({ input, ctx }) => {
        const db = await requireDb();
        if (input.id) {
          await db.update(shops).set({ name: input.name, active: input.active }).where(eq(shops.id, input.id));
          return { id: input.id };
        }
        const result = await db.insert(shops).values({ name: input.name, active: input.active, createdBy: ctx.user.id }).returning({ id: shops.id });
        return { id: result[0]!.id };
      }),
    prices: protectedProcedure.query(async () => {
      const db = await requireDb();
      return db
        .select({ price: shopItemPrices, shop: shops, item: items })
        .from(shopItemPrices)
        .innerJoin(shops, eq(shopItemPrices.shopId, shops.id))
        .innerJoin(items, eq(shopItemPrices.itemId, items.id))
        .orderBy(asc(shops.name), asc(items.sortOrder));
    }),
    savePrice: adminProcedure
      .input(z.object({ shopId: z.number().int().positive(), itemId: z.number().int().positive(), sellingPricePerUnit: nonNegative, active: z.boolean().default(true) }))
      .mutation(async ({ input }) => {
        const db = await requireDb();
        const item = await db.select().from(items).where(eq(items.id, input.itemId)).limit(1);
        if (!item[0] || item[0].itemType !== "sales") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Shop prices can only be assigned to Sales items." });
        }
        await db
          .insert(shopItemPrices)
          .values({ ...input, sellingPricePerUnit: input.sellingPricePerUnit.toFixed(2) })
          .onConflictDoUpdate({ target: [shopItemPrices.shopId, shopItemPrices.itemId], set: { sellingPricePerUnit: input.sellingPricePerUnit.toFixed(2), active: input.active } });
        return { success: true };
      }),
  }),

  sales: router({
    daily: protectedProcedure
      .input(z.object({ date: businessDate, shopId: z.number().int().positive() }))
      .query(async ({ input }) => {
        const db = await requireDb();
        const activeItems = await db
          .select()
          .from(items)
          .where(and(eq(items.itemType, "sales"), lte(items.effectiveFrom, dbDate(input.date)), or(isNull(items.inactiveFrom), gt(items.inactiveFrom, dbDate(input.date)))))
          .orderBy(asc(items.sortOrder), asc(items.name));
        const [entries, prices] = await Promise.all([
          db.select().from(salesEntries).where(and(eq(salesEntries.shopId, input.shopId), lte(salesEntries.saleDate, dbDate(input.date)))),
          db.select().from(shopItemPrices).where(and(eq(shopItemPrices.shopId, input.shopId), eq(shopItemPrices.active, true))),
        ]);
        const entryByKey = new Map(entries.map(row => [`${row.itemId}|${toDate(row.saleDate)}`, row]));
        const dates = Array.from(new Set([input.date, ...entries.map(row => toDate(row.saleDate))])).sort();
        const priceByItem = new Map(prices.map(row => [row.itemId, number(row.sellingPricePerUnit)]));
        return activeItems.map(item => {
          let opening = 0;
          let result: any = null;
          for (const currentDate of dates) {
            const row = entryByKey.get(`${item.id}|${currentDate}`);
            if (row?.openingOverrideQtyGrams !== null && row?.openingOverrideQtyGrams !== undefined) opening = number(row.openingOverrideQtyGrams);
            const produceQtyGrams = number(row?.produceQtyGrams);
            const sellQtyGrams = number(row?.sellQtyGrams);
            const closingQtyGrams = calculateSalesClosing(opening, produceQtyGrams, sellQtyGrams);
            if (currentDate === input.date) {
              const sellingPricePerUnit = number(row?.sellingPricePerUnit) || priceByItem.get(item.id) || 0;
              result = { item: publicItem(item), salesEntryId: row?.id ?? null, date: input.date, openingOverrideQtyGrams: row?.openingOverrideQtyGrams ?? null, openingQtyGrams: opening, openingReason: row?.openingReason ?? "", produceQtyGrams, sellQtyGrams, closingQtyGrams, sellingPricePerUnit, totalPrice: sellQtyGrams * sellingPricePerUnit, note: row?.note ?? "" };
            }
            opening = closingQtyGrams;
          }
          return result ?? { item: publicItem(item), salesEntryId: null, date: input.date, openingOverrideQtyGrams: null, openingQtyGrams: 0, openingReason: "", produceQtyGrams: 0, sellQtyGrams: 0, closingQtyGrams: 0, sellingPricePerUnit: priceByItem.get(item.id) ?? 0, totalPrice: 0, note: "" };
        });
      }),
    save: protectedProcedure
      .input(z.object({ date: businessDate, shopId: z.number().int().positive(), itemId: z.number().int().positive(), produceQtyGrams: nonNegative, sellQtyGrams: nonNegative, openingOverrideQtyGrams: nonNegative.optional().nullable(), openingReason: z.string().trim().max(500).optional().nullable(), note: z.string().trim().max(2000).optional().nullable() }))
      .mutation(async ({ input, ctx }) => {
        const db = await requireDb();
        await assertDayOpen(input.date, "sales");
        if (input.openingOverrideQtyGrams !== null && input.openingOverrideQtyGrams !== undefined && !input.openingReason?.trim()) throw new TRPCError({ code: "BAD_REQUEST", message: "Opening edit reason is required." });
        const item = await db.select().from(items).where(eq(items.id, input.itemId)).limit(1);
        if (!item[0] || item[0].itemType !== "sales") throw new TRPCError({ code: "BAD_REQUEST", message: "The item does not belong to Sales." });
        ensureEffective(item[0], input.date);
        const price = await db.select().from(shopItemPrices).where(and(eq(shopItemPrices.shopId, input.shopId), eq(shopItemPrices.itemId, input.itemId), eq(shopItemPrices.active, true))).limit(1);
        if (!price[0]) throw new TRPCError({ code: "BAD_REQUEST", message: "Set an active shop-item price before saving a sale." });
        const sellingPricePerUnit = number(price[0].sellingPricePerUnit);
        await db
          .insert(salesEntries)
          .values({ ...input, saleDate: dbDate(input.date), produceQtyGrams: input.produceQtyGrams.toString(), sellQtyGrams: input.sellQtyGrams.toString(), openingOverrideQtyGrams: input.openingOverrideQtyGrams === null || input.openingOverrideQtyGrams === undefined ? null : input.openingOverrideQtyGrams.toString(), openingReason: input.openingReason?.trim() || null, sellingPricePerUnit: sellingPricePerUnit.toFixed(2), note: input.note || null, createdBy: ctx.user.id })
          .onConflictDoUpdate({ target: [salesEntries.saleDate, salesEntries.shopId, salesEntries.itemId], set: { produceQtyGrams: input.produceQtyGrams.toString(), sellQtyGrams: input.sellQtyGrams.toString(), openingOverrideQtyGrams: input.openingOverrideQtyGrams === null || input.openingOverrideQtyGrams === undefined ? null : input.openingOverrideQtyGrams.toString(), openingReason: input.openingReason?.trim() || null, sellingPricePerUnit: sellingPricePerUnit.toFixed(2), note: input.note || null, createdBy: ctx.user.id } });
        const saved = await db.select({ id: salesEntries.id }).from(salesEntries).where(and(eq(salesEntries.saleDate, dbDate(input.date)), eq(salesEntries.shopId, input.shopId), eq(salesEntries.itemId, input.itemId))).limit(1);
        await recordAudit(ctx, input.openingOverrideQtyGrams !== null && input.openingOverrideQtyGrams !== undefined ? "opening_override" : "sales_save", "salesEntries", saved[0]?.id ?? null, input.date, { itemId: input.itemId, shopId: input.shopId, reason: input.openingReason ?? null });
        return { success: true };
      }),
  }),

  recipes: router({
    list: protectedProcedure.query(async () => {
      const db = await requireDb();
      const [recipeRows, lineRows] = await Promise.all([
        db.select({ recipe: recipes, output: items }).from(recipes).leftJoin(items, eq(recipes.outputItemId, items.id)).orderBy(asc(recipes.name)),
        db.select({ line: recipeLines, item: items }).from(recipeLines).innerJoin(items, eq(recipeLines.itemId, items.id)),
      ]);
      return recipeRows.map(row => ({ ...row.recipe, outputItem: row.output ? publicItem(row.output) : null, lines: lineRows.filter(line => line.line.recipeId === row.recipe.id).map(line => ({ ...line.line, item: publicItem(line.item) })) }));
    }),
    save: adminProcedure
      .input(z.object({ id: z.number().int().positive().optional(), name: z.string().trim().min(1).max(180), outputItemId: z.number().int().positive().optional().nullable(), outputQuantityGrams: positive, note: z.string().trim().max(2000).optional().nullable(), active: z.boolean().default(true), effectiveFrom: businessDate.default("1970-01-01"), lines: z.array(z.object({ itemId: z.number().int().positive(), quantityGrams: positive })) }))
      .mutation(async ({ input, ctx }) => {
        const db = await requireDb();
        let recipeId = input.id;
        if (recipeId) {
          const existing = await db.select().from(recipes).where(eq(recipes.id, recipeId)).limit(1);
          if (existing[0] && input.effectiveFrom < toDate(existing[0].effectiveFrom)) throw new TRPCError({ code: "BAD_REQUEST", message: "Recipe effective date cannot move earlier; create a new version on or after the current effective date." });
          if (existing[0] && input.effectiveFrom > toDate(existing[0].effectiveFrom)) {
            const result = await db.insert(recipes).values({ name: input.name, outputItemId: input.outputItemId || null, outputQuantityGrams: input.outputQuantityGrams.toString(), note: input.note || null, active: input.active, effectiveFrom: dbDate(input.effectiveFrom), createdBy: ctx.user.id }).returning({ id: recipes.id });
            recipeId = result[0]!.id;
          } else {
            await db.update(recipes).set({ name: input.name, outputItemId: input.outputItemId || null, outputQuantityGrams: input.outputQuantityGrams.toString(), note: input.note || null, active: input.active, effectiveFrom: dbDate(input.effectiveFrom) }).where(eq(recipes.id, recipeId));
            await db.delete(recipeLines).where(eq(recipeLines.recipeId, recipeId));
          }
        } else {
          const result = await db.insert(recipes).values({ name: input.name, outputItemId: input.outputItemId || null, outputQuantityGrams: input.outputQuantityGrams.toString(), note: input.note || null, active: input.active, effectiveFrom: dbDate(input.effectiveFrom), createdBy: ctx.user.id }).returning({ id: recipes.id });
          recipeId = result[0]!.id;
        }
        if (input.lines.length) await db.insert(recipeLines).values(input.lines.map(line => ({ recipeId: recipeId!, itemId: line.itemId, quantityGrams: line.quantityGrams.toString() })));
        return { id: recipeId };
      }),
    delete: adminProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ input }) => {
        const db = await requireDb();
        await db.delete(recipes).where(eq(recipes.id, input.id));
        return { success: true };
      }),
  }),

  orders: router({
    daily: protectedProcedure.input(z.object({ date: businessDate })).query(async ({ input }) => {
      const db = await requireDb();
      const salesItems = await db.select().from(items).where(and(eq(items.itemType, "sales"), lte(items.effectiveFrom, dbDate(input.date)), or(isNull(items.inactiveFrom), gt(items.inactiveFrom, dbDate(input.date))))).orderBy(asc(items.sortOrder), asc(items.name));
      const saved = await db.select().from(orders).where(eq(orders.orderDate, dbDate(input.date)));
      return salesItems.map(item => ({ item: publicItem(item, true), order: saved.find(row => row.salesItemId === item.id) ?? null }));
    }),
    save: protectedProcedure.input(z.object({ date: businessDate, salesItemId: z.number().int().positive(), quantity: nonNegative, note: z.string().trim().max(2000).optional().nullable() })).mutation(async ({ input, ctx }) => {
      const db = await requireDb();
      const item = await db.select().from(items).where(eq(items.id, input.salesItemId)).limit(1);
      if (!item[0] || item[0].itemType !== "sales") throw new TRPCError({ code: "BAD_REQUEST", message: "Orders can only be placed for Sales items." });
      ensureEffective(item[0], input.date);
      await db.insert(orders).values({ orderDate: dbDate(input.date), salesItemId: input.salesItemId, quantity: input.quantity.toString(), note: input.note || null, createdBy: ctx.user.id }).onConflictDoUpdate({ target: [orders.orderDate, orders.salesItemId], set: { quantity: input.quantity.toString(), note: input.note || null, createdBy: ctx.user.id, updatedAt: new Date() } });
      await recordAudit(ctx, "order_save", "orders", null, input.date, { salesItemId: input.salesItemId, quantity: input.quantity, note: input.note ?? null });
      return { success: true };
    }),
  }),

  dashboard: protectedProcedure.input(z.object({ date: businessDate })).query(async ({ input }) => {
    const db = await requireDb();
    const [production, packaging, dayPurchases, salesRows, previousSalesRows, salesItems, costMap] = await Promise.all([
      operationLedgerForDate(input.date, "production"),
      operationLedgerForDate(input.date, "packaging"),
      db.select().from(purchases).where(and(eq(purchases.status, "confirmed"), eq(purchases.purchaseDate, dbDate(input.date)))),
      db.select().from(salesEntries).where(eq(salesEntries.saleDate, dbDate(input.date))),
      db.select().from(salesEntries).where(lt(salesEntries.saleDate, dbDate(input.date))),
      db.select().from(items).where(and(eq(items.itemType, "sales"), lte(items.effectiveFrom, dbDate(input.date)), or(isNull(items.inactiveFrom), gt(items.inactiveFrom, dbDate(input.date))))),
      monthlyCostMap(input.date),
    ]);
    const purchaseQtyGrams = dayPurchases.reduce((total, row) => total + number(row.quantityGrams), 0);
    const purchaseCost = dayPurchases.reduce((total, row) => total + number(row.totalCost), 0);
    const operationRows = [...production, ...packaging];
    const closingValue = operationRows.reduce((total, row) => total + row.closingQtyGrams * (costMap.get(row.item.id) ?? 0), 0);
    const damageQtyGrams = operationRows.reduce((total, row) => total + row.damageQtyGrams, 0);
    const damageValue = operationRows.reduce((total, row) => total + row.damageQtyGrams * (costMap.get(row.item.id) ?? 0), 0);
    const salesRevenue = salesRows.reduce((total, row) => total + number(row.sellQtyGrams) * number(row.sellingPricePerUnit), 0);
    const salesItemById = new Map(salesItems.map(item => [item.id, item]));
    const salesClosingByItem = new Map<number, number>();
    [...previousSalesRows, ...salesRows].forEach(row => {
      salesClosingByItem.set(row.itemId, (salesClosingByItem.get(row.itemId) ?? 0) + number(row.produceQtyGrams) - number(row.sellQtyGrams));
    });
    const salesCost = salesRows.reduce((total, row) => {
      const item = salesItemById.get(row.itemId);
      return total + number(row.sellQtyGrams) * ((item?.costPerUnit ? number(item.costPerUnit) : 0) / (item ? number(item.gramsPerDisplayUnit) : 1));
    }, 0);
    const lowStock = [
      ...operationRows.map(row => ({ item: row.item, closingQtyGrams: row.closingQtyGrams })),
      ...salesItems.map(item => ({ item: publicItem(item), closingQtyGrams: salesClosingByItem.get(item.id) ?? 0 })),
    ].filter(row => row.closingQtyGrams < number(row.item.minStockGrams));
    const salesQty = salesRows.reduce((total, row) => total + number(row.sellQtyGrams), 0);
    return { purchaseQtyGrams, purchaseCost, closingValue, damageQtyGrams, damageValue, salesQty, salesRevenue, salesMargin: salesRevenue - salesCost, lowStock };
  }),

  reports: router({
    summary: protectedProcedure
      .input(z.object({ from: businessDate, to: businessDate }))
      .query(async ({ input }) => {
        if (input.from > input.to) throw new TRPCError({ code: "BAD_REQUEST", message: "Start date must not be later than end date." });
        const db = await requireDb();
        const [purchaseRows, operationRows, saleRows, priorSaleRows, itemRows, openingProduction, openingPackaging, closingProduction, closingPackaging] = await Promise.all([
          db.select({ purchase: purchases, item: items }).from(purchases).innerJoin(items, eq(purchases.itemId, items.id)).where(and(eq(purchases.status, "confirmed"), gte(purchases.purchaseDate, dbDate(input.from)), lte(purchases.purchaseDate, dbDate(input.to)))),
          db.select({ operation: operations, item: items }).from(operations).innerJoin(items, eq(operations.itemId, items.id)).where(and(gte(operations.operationDate, dbDate(input.from)), lte(operations.operationDate, dbDate(input.to)))),
          db.select({ sale: salesEntries, item: items, shop: shops }).from(salesEntries).innerJoin(items, eq(salesEntries.itemId, items.id)).innerJoin(shops, eq(salesEntries.shopId, shops.id)).where(and(gte(salesEntries.saleDate, dbDate(input.from)), lte(salesEntries.saleDate, dbDate(input.to)))),
          db.select().from(salesEntries).where(lt(salesEntries.saleDate, dbDate(input.from))),
          db.select().from(items).orderBy(asc(items.itemType), asc(items.sortOrder)),
          operationLedgerForDate(input.from, "production"),
          operationLedgerForDate(input.from, "packaging"),
          operationLedgerForDate(input.to, "production"),
          operationLedgerForDate(input.to, "packaging"),
        ]);
        const openingByItem = new Map([...openingProduction, ...openingPackaging].map(row => [row.item.id, row.openingQtyGrams]));
        const closingByItem = new Map([...closingProduction, ...closingPackaging].map(row => [row.item.id, row.closingQtyGrams]));
        const salesOpeningByItem = new Map<number, number>();
        priorSaleRows.forEach(row => salesOpeningByItem.set(row.itemId, (salesOpeningByItem.get(row.itemId) ?? 0) + number(row.produceQtyGrams) - number(row.sellQtyGrams)));
        const monthlyMaps = new Map<string, Map<number, number>>();
        const costsFor = async (date: string) => {
          const month = monthStart(date);
          if (!monthlyMaps.has(month)) monthlyMaps.set(month, await monthlyCostMap(date));
          return monthlyMaps.get(month)!;
        };
        const perItem = await Promise.all(itemRows.map(async item => {
          const matchedPurchases = purchaseRows.filter(row => row.purchase.itemId === item.id);
          const matchedOperations = operationRows.filter(row => row.operation.itemId === item.id);
          const matchedSales = saleRows.filter(row => row.sale.itemId === item.id);
          let usedValue = 0;
          let damageValue = 0;
          for (const row of matchedOperations) {
            const cost = (await costsFor(toDate(row.operation.operationDate))).get(item.id) ?? 0;
            usedValue += (number(row.operation.issuedQtyGrams) - number(row.operation.returnQtyGrams) - number(row.operation.damageQtyGrams)) * cost;
            damageValue += number(row.operation.damageQtyGrams) * cost;
          }
          return {
            item: publicItem(item),
            openingQty: item.itemType === "sales" ? salesOpeningByItem.get(item.id) ?? 0 : openingByItem.get(item.id) ?? 0,
            inQty: matchedPurchases.reduce((sum, row) => sum + number(row.purchase.quantityGrams), 0),
            issuedQty: matchedOperations.reduce((sum, row) => sum + number(row.operation.issuedQtyGrams), 0),
            returnQty: matchedOperations.reduce((sum, row) => sum + number(row.operation.returnQtyGrams), 0),
            closingQty: item.itemType === "sales" ? calculateSalesClosing(salesOpeningByItem.get(item.id) ?? 0, matchedSales.reduce((sum, row) => sum + number(row.sale.produceQtyGrams), 0), matchedSales.reduce((sum, row) => sum + number(row.sale.sellQtyGrams), 0)) : closingByItem.get(item.id) ?? 0,
            averageCost: (await costsFor(input.to)).get(item.id) ?? 0,
            purchaseQtyGrams: matchedPurchases.reduce((sum, row) => sum + number(row.purchase.quantityGrams), 0),
            purchaseCost: matchedPurchases.reduce((sum, row) => sum + number(row.purchase.totalCost), 0),
            usedQtyGrams: matchedOperations.reduce((sum, row) => sum + number(row.operation.issuedQtyGrams) - number(row.operation.returnQtyGrams) - number(row.operation.damageQtyGrams), 0),
            usedValue,
            damageQtyGrams: matchedOperations.reduce((sum, row) => sum + number(row.operation.damageQtyGrams), 0),
            damageValue,
            produceQtyGrams: matchedSales.reduce((sum, row) => sum + number(row.sale.produceQtyGrams), 0),
            sellQtyGrams: matchedSales.reduce((sum, row) => sum + number(row.sale.sellQtyGrams), 0),
            salesValue: matchedSales.reduce((sum, row) => sum + number(row.sale.sellQtyGrams) * number(row.sale.sellingPricePerUnit), 0),
            closingValue: (item.itemType === "sales" ? 0 : closingByItem.get(item.id) ?? 0) * ((await costsFor(input.to)).get(item.id) ?? 0),
            salesByShop: Array.from(new Map(matchedSales.map(row => [row.shop.id, { shopName: row.shop.name, sellQty: 0, salesValue: 0 }])).entries()).map(([shopId, summary]) => ({ shopId, ...matchedSales.filter(row => row.shop.id === shopId).reduce((total, row) => ({ ...total, sellQty: total.sellQty + number(row.sale.sellQtyGrams), salesValue: total.salesValue + number(row.sale.sellQtyGrams) * number(row.sale.sellingPricePerUnit) }), summary) })),
          };
        }));
        return { purchases: purchaseRows, operations: operationRows, sales: saleRows, perItem };
      }),
  }),

  admin: router({
    users: adminProcedure.query(async () => {
      const db = await requireDb();
      return db.select({ id: users.id, name: users.name, email: users.email, role: users.role, lastSignedIn: users.lastSignedIn }).from(users).orderBy(asc(users.name));
    }),
    setRole: adminProcedure.input(z.object({ userId: z.number().int().positive(), role: z.enum(["user", "admin"]) })).mutation(async ({ input }) => {
      const db = await requireDb();
      await db.update(users).set({ role: input.role }).where(eq(users.id, input.userId));
      return { success: true };
    }),
    backup: adminProcedure.query(async () => {
      const db = await requireDb();
      const [itemRows, purchaseRows, operationRows, orderRows, shopRows, priceRows, saleRows, recipeRows, lineRows] = await Promise.all([db.select().from(items), db.select().from(purchases), db.select().from(operations), db.select().from(orders), db.select().from(shops), db.select().from(shopItemPrices), db.select().from(salesEntries), db.select().from(recipes), db.select().from(recipeLines)]);
      return { exportedAt: new Date().toISOString(), items: itemRows, purchases: purchaseRows, operations: operationRows, orders: orderRows, shops: shopRows, shopItemPrices: priceRows, salesEntries: saleRows, recipes: recipeRows, recipeLines: lineRows };
    }),
  }),
});
