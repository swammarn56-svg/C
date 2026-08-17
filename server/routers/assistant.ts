import { and, asc, eq, gte, gt, isNull, lte, or } from "drizzle-orm";
import { z } from "zod";
import { items, operations, purchases, salesEntries } from "../../drizzle/schema";
import { invokeLLM } from "../_core/llm";
import { protectedProcedure, router } from "../_core/trpc";
import { requireDb } from "../db";
import { operationLedgerForDate } from "./inventory";

const businessDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const toDbDate = (value: string) => new Date(`${value}T00:00:00.000Z`);
const toDate = (value: unknown) => value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
const num = (value: unknown) => Number(value ?? 0);
const monthStart = (value: string) => `${value.slice(0, 7)}-01`;

const intentSchema = {
  type: "object",
  properties: {
    intent: { type: "string", enum: ["closing", "used_total", "purchase_total", "damage_total", "sales_total", "unknown"] },
    itemId: { type: ["integer", "null"] },
    itemName: { type: ["string", "null"] },
    table: { type: "string", enum: ["production", "packaging", "sales", "purchases", "any", "unknown"] },
    fromDate: { type: ["string", "null"] },
    toDate: { type: ["string", "null"] },
    confidence: { type: "number" },
  },
  required: ["intent", "itemId", "itemName", "table", "fromDate", "toDate", "confidence"],
  additionalProperties: false,
} as const;

type ParsedIntent = {
  intent: "closing" | "used_total" | "purchase_total" | "damage_total" | "sales_total" | "unknown";
  itemId: number | null;
  itemName: string | null;
  table: "production" | "packaging" | "sales" | "purchases" | "any" | "unknown";
  fromDate: string | null;
  toDate: string | null;
  confidence: number;
};

function normalize(value: string) {
  return value.normalize("NFC").replace(/[\s၊၊။,.!?]+/g, "").toLowerCase();
}

function formatQuantity(value: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 3 }).format(value);
}

function dateRange(parsed: ParsedIntent, date: string) {
  const from = parsed.fromDate || (parsed.intent === "used_total" || parsed.intent === "purchase_total" || parsed.intent === "damage_total" || parsed.intent === "sales_total" ? monthStart(date) : date);
  const to = parsed.toDate || date;
  return { from, to };
}

export const assistantRouter = router({
  ask: protectedProcedure
    .input(z.object({ question: z.string().trim().min(1).max(1000), date: businessDate }))
    .mutation(async ({ input }) => {
      const db = await requireDb();
      const catalog = await db.select({ id: items.id, name: items.name, itemType: items.itemType, displayUnit: items.displayUnit })
        .from(items)
        .where(and(lte(items.effectiveFrom, toDbDate(input.date)), or(isNull(items.inactiveFrom), gt(items.inactiveFrom, toDbDate(input.date)))))
        .orderBy(asc(items.sortOrder), asc(items.name));
      if (!catalog.length) return { answer: "လက်ရှိနေ့အတွက် Item စာရင်းမတွေ့ပါ။", parsed: null, readOnly: true };

      const catalogText = catalog.map(item => `${item.id}|${item.name}|${item.itemType}`).join("\n");
      const response = await invokeLLM({
        model: "gpt-5-mini",
        messages: [
          { role: "system", content: "You are Ella, a read-only bakery ERP question parser. Understand Burmese and Burmese-English mixed questions. Never invent an item ID. Map the question only to one of the allowed intents. The server will execute read-only queries; do not return SQL. Use the supplied catalog. For current-day questions leave dates null. For a month/current-period usage question, leave dates null so the server uses the current month start through the business date. If the question is not a supported ERP read question, use unknown." },
          { role: "user", content: `Global Business Date: ${input.date}\nItem catalog (id|name|type):\n${catalogText}\n\nQuestion:\n${input.question}` },
        ],
        response_format: { type: "json_schema", json_schema: { name: "ella_intent", strict: true, schema: intentSchema } },
        reasoning: { effort: "low" },
      });
      const content = response.choices[0]?.message?.content;
      if (typeof content !== "string") return { answer: "မေးခွန်းကို နားမလည်သေးပါ။ Item နဲ့ လိုချင်တဲ့စာရင်းကို ထပ်ပြောပေးပါ။", parsed: null, readOnly: true };
      let parsed: ParsedIntent;
      try { parsed = JSON.parse(content) as ParsedIntent; } catch { return { answer: "မေးခွန်းကို စာရင်းမေးခွန်းအဖြစ် မခွဲနိုင်သေးပါ။", parsed: null, readOnly: true }; }
      if (parsed.intent === "unknown") return { answer: "Ella က လက်ရှိ Closing, Used, Purchase, Damage နဲ့ Sales စာရင်းတွေကိုသာ ဖတ်ပြနိုင်ပါတယ်။", parsed, readOnly: true };

      const requestedId = parsed.itemId && catalog.some(item => item.id === parsed.itemId) ? parsed.itemId : null;
      const requestedName = parsed.itemName ? normalize(parsed.itemName) : "";
      const exactMatches = requestedName ? catalog.filter(item => normalize(item.name) === requestedName) : [];
      const partialMatches = requestedName && !exactMatches.length ? catalog.filter(item => normalize(item.name).includes(requestedName) || requestedName.includes(normalize(item.name))) : [];
      const matched = requestedId ? catalog.filter(item => item.id === requestedId) : exactMatches.length ? exactMatches : partialMatches;
      if (matched.length !== 1) {
        const names = matched.slice(0, 5).map(item => item.name).join("၊ ");
        return { answer: matched.length ? `ဒီ Item အမည်က မရှင်းသေးပါ။ ${names} ထဲက တစ်ခုကို ရွေးပေးပါ။` : "ဒီနေ့အတွက် အဲဒီ Item ကို မတွေ့ပါ။ Item Dashboard ထဲက အမည်အတိုင်း ပြန်မေးပေးပါ။", parsed, candidates: matched, readOnly: true };
      }
      const item = matched[0];
      const range = dateRange(parsed, input.date);
      if (range.from > range.to) return { answer: "စတင်ရက်က အဆုံးရက်ထက် နောက်ကျနေပါတယ်။", parsed, readOnly: true };

      if (parsed.intent === "closing") {
        const tables = parsed.table === "production" || parsed.table === "packaging" ? [parsed.table] : item.itemType === "production" || item.itemType === "packaging" ? [item.itemType] : ["production", "packaging"];
        const results = [] as Array<{ table: string; value: number; unit: string }>;
        for (const table of tables) {
          if (item.itemType !== table) continue;
          const row = (await operationLedgerForDate(input.date, table as "production" | "packaging")).find(entry => entry.item.id === item.id);
          if (row) results.push({ table, value: num(row.closingQtyGrams), unit: row.item.displayUnit || "g" });
        }
        if (item.itemType === "sales") {
          const salesRows = await db.select({ produce: salesEntries.produceQtyGrams, sell: salesEntries.sellQtyGrams }).from(salesEntries).where(and(eq(salesEntries.itemId, item.id), lte(salesEntries.saleDate, toDbDate(input.date))));
          results.push({ table: "sales", value: salesRows.reduce((sum, row) => sum + num(row.produce) - num(row.sell), 0), unit: item.displayUnit || "g" });
        }
        const summary = results.map(result => `${result.table} ${formatQuantity(result.value)} ${result.unit}`).join("၊ ");
        return { answer: `${item.name} ရဲ့ ${input.date} Closing က ${summary || "မှတ်တမ်းမရှိပါ"} ဖြစ်ပါတယ်။`, parsed, date: input.date, item, results, readOnly: true };
      }

      if (parsed.intent === "used_total") {
        const operationRows = await db.select({ issued: operations.issuedQtyGrams, returned: operations.returnQtyGrams, damage: operations.damageQtyGrams }).from(operations).where(and(eq(operations.itemId, item.id), gte(operations.operationDate, toDbDate(range.from)), lte(operations.operationDate, toDbDate(range.to))));
        const value = operationRows.reduce((sum, row) => sum + num(row.issued) - num(row.returned) - num(row.damage), 0);
        return { answer: `${item.name} ကို ${range.from} ကနေ ${range.to} အထိ Used စုစုပေါင်း ${formatQuantity(value)} ${item.displayUnit || "g"} ရှိပါတယ်။`, parsed, dateRange: range, item, value, readOnly: true };
      }

      if (parsed.intent === "purchase_total") {
        const purchaseRows = await db.select({ quantity: purchases.quantityGrams, cost: purchases.totalCost }).from(purchases).where(and(eq(purchases.itemId, item.id), eq(purchases.status, "confirmed"), gte(purchases.purchaseDate, toDbDate(range.from)), lte(purchases.purchaseDate, toDbDate(range.to))));
        const value = purchaseRows.reduce((sum, row) => sum + num(row.quantity), 0);
        const cost = purchaseRows.reduce((sum, row) => sum + num(row.cost), 0);
        return { answer: `${item.name} ရဲ့ ${range.from} ကနေ ${range.to} အထိ Purchase စုစုပေါင်း ${formatQuantity(value)} ${item.displayUnit || "g"}၊ တန်ဖိုး ${cost.toFixed(2)} ဖြစ်ပါတယ်။`, parsed, dateRange: range, item, value, cost, readOnly: true };
      }

      if (parsed.intent === "damage_total") {
        const damageRows = await db.select({ damage: operations.damageQtyGrams }).from(operations).where(and(eq(operations.itemId, item.id), gte(operations.operationDate, toDbDate(range.from)), lte(operations.operationDate, toDbDate(range.to))));
        const value = damageRows.reduce((sum, row) => sum + num(row.damage), 0);
        return { answer: `${item.name} ရဲ့ Damage စုစုပေါင်း ${formatQuantity(value)} ${item.displayUnit || "g"} ရှိပါတယ်။`, parsed, dateRange: range, item, value, readOnly: true };
      }

      const salesRows = await db.select({ sell: salesEntries.sellQtyGrams, value: salesEntries.sellingPricePerUnit }).from(salesEntries).where(and(eq(salesEntries.itemId, item.id), gte(salesEntries.saleDate, toDbDate(range.from)), lte(salesEntries.saleDate, toDbDate(range.to))));
      const quantity = salesRows.reduce((sum, row) => sum + num(row.sell), 0);
      const revenue = salesRows.reduce((sum, row) => sum + num(row.sell) * num(row.value), 0);
      return { answer: `${item.name} ရဲ့ ${range.from} ကနေ ${range.to} အထိ Sales ${formatQuantity(quantity)} ${item.displayUnit || "g"}၊ ရောင်းရငွေ ${revenue.toFixed(2)} ဖြစ်ပါတယ်။`, parsed, dateRange: range, item, quantity, revenue, readOnly: true };
    }),
});
