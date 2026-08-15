import fs from "node:fs";

const planArgument = process.argv.find(argument => argument.startsWith("--plan="));
const planPath = planArgument ? planArgument.slice("--plan=".length) : "/home/ubuntu/august-ledger-reconciliation.json";
const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const apply = process.argv.includes("--apply");
if (!supabaseUrl || !serviceRoleKey) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
if (!fs.existsSync(planPath)) throw new Error(`Reconciliation plan not found: ${planPath}`);

const { plan, summary } = JSON.parse(fs.readFileSync(planPath, "utf8"));
if (plan.unresolved.length) throw new Error(`Refusing to apply a plan with ${plan.unresolved.length} unresolved rows.`);
if (!apply) {
  console.log(JSON.stringify({ dryRun: true, summary, updates: plan.updates.length, inserts: plan.inserts.length, effectiveFromUpdates: plan.effectiveFromUpdates.length }, null, 2));
  process.exit(0);
}

const headers = {
  apikey: serviceRoleKey,
  Authorization: `Bearer ${serviceRoleKey}`,
  "Content-Type": "application/json",
};
async function request(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) throw new Error(`${options.method ?? "GET"} ${url} failed: ${response.status} ${await response.text()}`);
  return response.headers.get("content-range") ?? "";
}
async function withConcurrency(values, limit, worker) {
  let cursor = 0;
  const results = [];
  await Promise.all(Array.from({ length: Math.min(limit, values.length) }, async () => {
    while (cursor < values.length) {
      const index = cursor++;
      results[index] = await worker(values[index]);
    }
  }));
  return results;
}

const updateResults = await withConcurrency(plan.updates, 8, async row => {
  const filters = new URLSearchParams({
    id: `eq.${row.operationId}`,
  });
  const range = await request(`${supabaseUrl}/rest/v1/operations?${filters}`, {
    method: "PATCH",
    headers: { ...headers, Prefer: "return=representation" },
    body: JSON.stringify({ openingOverrideQtyGrams: row.openingOverrideQtyGrams, inOverrideQtyGrams: row.inOverrideQtyGrams }),
  });
  return range;
});

const insertPayload = plan.inserts.map(row => ({
  operationDate: row.date,
  itemId: row.itemId,
  operationType: row.type,
  openingOverrideQtyGrams: row.openingOverrideQtyGrams,
  inOverrideQtyGrams: row.inOverrideQtyGrams,
  issuedQtyGrams: row.issuedQtyGrams,
  returnQtyGrams: row.returnQtyGrams,
  damageQtyGrams: row.damageQtyGrams,
  note: row.note,
}));
const insertResults = [];
for (let index = 0; index < insertPayload.length; index += 100) {
  const batch = insertPayload.slice(index, index + 100);
  const range = await request(`${supabaseUrl}/rest/v1/operations?on_conflict=operationDate,itemId,operationType`, {
    method: "POST",
    headers: { ...headers, Prefer: "resolution=ignore-duplicates,return=representation" },
    body: JSON.stringify(batch),
  });
  insertResults.push(range);
}

for (const item of plan.effectiveFromUpdates) {
  await request(`${supabaseUrl}/rest/v1/items?id=eq.${item.itemId}`, {
    method: "PATCH",
    headers: { ...headers, Prefer: "return=representation" },
    body: JSON.stringify({ effectiveFrom: item.effectiveFrom }),
  });
}

await request(`${supabaseUrl}/rest/v1/auditLogs`, {
  method: "POST",
  headers: { ...headers, Prefer: "return=minimal" },
  body: JSON.stringify({ action: "historical_import_repair", entityType: "operations", businessDate: "2026-08-01", details: JSON.stringify({ source: "August original CSV", range: plan.range, updatedOperations: plan.updates.length, attemptedInserts: plan.inserts.length, effectiveFromUpdates: plan.effectiveFromUpdates.length, reconciliationGeneratedAt: plan.generatedAt }) }),
});

console.log(JSON.stringify({ applied: true, updatedOperations: updateResults.length, attemptedInserts: insertPayload.length, insertBatches: insertResults.length, effectiveFromUpdates: plan.effectiveFromUpdates.length }, null, 2));
