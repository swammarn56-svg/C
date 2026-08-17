export type EllaItemCandidate = { id: number; name: string; itemType?: string; displayUnit?: string | null };
export type EllaReportIntent = "closing" | "used_total" | "purchase_total" | "damage_total" | "sales_total" | "unknown";
export type EllaParsedIntent = { intent: EllaReportIntent; itemId: number | null; itemName: string | null; table: "production" | "packaging" | "sales" | "purchases" | "any" | "unknown"; fromDate: string | null; toDate: string | null; confidence: number };

export function normalizeEllaText(value: string) {
  return value.normalize("NFC").replace(/[\s၊၊။,.!?]+/g, "").toLowerCase();
}

export function matchEllaItems(items: EllaItemCandidate[], requestedName: string, requestedId?: number | null) {
  if (requestedId != null) {
    const byId = items.filter(item => item.id === requestedId);
    if (byId.length) return byId;
  }
  const normalized = normalizeEllaText(requestedName);
  if (!normalized) return [];
  const exact = items.filter(item => normalizeEllaText(item.name) === normalized);
  if (exact.length) return exact;
  return items.filter(item => normalizeEllaText(item.name).includes(normalized) || normalized.includes(normalizeEllaText(item.name)));
}

export function resolveEllaDateRange(intent: EllaReportIntent, businessDate: string, fromDate?: string | null, toDate?: string | null) {
  const monthStart = `${businessDate.slice(0, 7)}-01`;
  const from = fromDate || (intent === "used_total" || intent === "purchase_total" || intent === "damage_total" || intent === "sales_total" ? monthStart : businessDate);
  const to = toDate || businessDate;
  return { from, to };
}

export function inferEllaIntent(question: string, items: EllaItemCandidate[]): EllaParsedIntent {
  const text = normalizeEllaText(question);
  const dates = Array.from(question.matchAll(/(20\d{2})[-/.年](\d{1,2})[-/.月](\d{1,2})日?/g)).map(match => `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`);
  const itemMatches = items.filter(item => text.includes(normalizeEllaText(item.name))).sort((a, b) => b.name.length - a.name.length);
  const table = text.includes("production") || text.includes("ထုတ်လုပ်") ? "production" : text.includes("packaging") || text.includes("ထုပ်ပိုး") ? "packaging" : text.includes("sales") || text.includes("sale") || text.includes("အရောင်း") ? "sales" : text.includes("purchase") || text.includes("ဝယ်") || text.includes("အဝင်") ? "purchases" : "any";
  const intent: EllaReportIntent = text.includes("closing") || text.includes("လက်ကျန်") || text.includes("ကျန်") ? "closing" : text.includes("used") || text.includes("အသုံး") || text.includes("သုံး") ? "used_total" : text.includes("damage") || text.includes("ပျက်") || text.includes("အပျက်") ? "damage_total" : text.includes("purchase") || text.includes("ဝယ်") || text.includes("အဝင်") ? "purchase_total" : text.includes("sales") || text.includes("sale") || text.includes("ရောင်း") || text.includes("အရောင်း") ? "sales_total" : "unknown";
  return { intent, itemId: itemMatches.length === 1 ? itemMatches[0].id : null, itemName: itemMatches.length ? itemMatches[0].name : null, table, fromDate: dates[0] || null, toDate: dates[1] || dates[0] || null, confidence: itemMatches.length === 1 && intent !== "unknown" ? 0.72 : 0.35 };
}
