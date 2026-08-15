import fs from "node:fs";
import path from "node:path";
import XLSX from "xlsx";

const uploadDir = "/home/ubuntu/upload";
const start = "2026-08-01";
const end = "2026-08-14";
const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for read-only reconciliation.");

function normalizeName(value) {
  return String(value ?? "").normalize("NFC").replace(/[\u200B-\u200D\uFEFF]/g, "").trim().toLocaleLowerCase();
}
function asNumber(value) {
  const parsed = Number(String(value ?? "").replaceAll(",", "").trim());
  return Number.isFinite(parsed) ? parsed : 0;
}
function equalNullableNumber(actual, desired) {
  return desired === null ? actual === null || actual === undefined : asNumber(actual) === desired;
}
function sourceCandidates(type, date) {
  return fs.readdirSync(uploadDir).filter(name => name.toLowerCase().endsWith(".csv") && name.toLowerCase().startsWith(`${type}-${date}`)).map(name => path.join(uploadDir, name));
}
function readRows(file) {
  const workbook = XLSX.readFile(file, { raw: false });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json(sheet, { defval: "" }).map(row => ({ name: String(row["Item Name"] ?? ""), opening: asNumber(row.Opening), in: asNumber(row.In), issued: asNumber(row.Issued), returned: asNumber(row.Return), damage: asNumber(row.Damage), note: String(row.Note ?? "") })).filter(row => row.name.trim());
}
function compareCandidate(candidateRows, liveRows) {
  const sourceByName = new Map(candidateRows.map(row => [normalizeName(row.name), row]));
  let overlap = 0;
  let exact = 0;
  let mismatches = 0;
  for (const live of liveRows) {
    const source = sourceByName.get(normalizeName(live.name));
    if (!source) continue;
    overlap += 1;
    if (source.issued === asNumber(live.issuedQtyGrams) && source.returned === asNumber(live.returnQtyGrams) && source.damage === asNumber(live.damageQtyGrams)) exact += 1;
    else mismatches += 1;
  }
  return { overlap, exact, mismatches, score: exact * 1000 + overlap * 10 - mismatches };
}
async function rest(table, query, range) {
  const params = Array.isArray(query) ? new URLSearchParams(query) : new URLSearchParams(query);
  const headers = { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}`, ...(range ? { Range: range } : {}) };
  const response = await fetch(`${supabaseUrl}/rest/v1/${table}?${params}`, { headers });
  if (!response.ok) throw new Error(`Supabase REST ${table} failed: ${response.status} ${await response.text()}`);
  return response.json();
}
async function restAll(table, query) {
  const rows = [];
  for (let offset = 0; ; offset += 1000) {
    const page = await rest(table, query, `${offset}-${offset + 999}`);
    rows.push(...page);
    if (page.length < 1000) return rows;
  }
}

const [items, operations] = await Promise.all([
  restAll("items", { select: "id,name,itemType,effectiveFrom", itemType: "in.(production,packaging)", order: "id.asc" }),
  restAll("operations", [["select", "id,itemId,operationType,operationDate,issuedQtyGrams,returnQtyGrams,damageQtyGrams,openingOverrideQtyGrams,inOverrideQtyGrams,note"], ["operationDate", `gte.${start}`], ["operationDate", `lte.${end}`], ["order", "operationDate.asc,itemId.asc"]]),
]);
const itemById = new Map(items.map(item => [item.id, item]));
const itemByTypeAndName = new Map();
for (const item of items) {
  const key = `${item.itemType}|${normalizeName(item.name)}`;
  itemByTypeAndName.set(key, [...(itemByTypeAndName.get(key) ?? []), item]);
}
const resolvedItemIdByTypeAndName = new Map();
const priorSourceClosingByItemId = new Map();
const report = [];
const plan = { generatedAt: new Date().toISOString(), range: { start, end }, updates: [], inserts: [], effectiveFromUpdates: [], unresolved: [] };

for (const type of ["production", "packaging"]) {
  for (let day = 1; day <= 14; day += 1) {
    const date = `2026-08-${String(day).padStart(2, "0")}`;
    const liveRows = operations.filter(row => row.operationType === type && String(row.operationDate).slice(0, 10) === date).map(row => ({ ...row, name: itemById.get(row.itemId)?.name ?? `missing-item-${row.itemId}` }));
    const candidates = sourceCandidates(type, date).map(file => ({ file, rows: readRows(file) }));
    if (!candidates.length) { report.push({ type, date, status: "missing-source" }); continue; }
    const ranked = candidates.map(candidate => ({ ...candidate, comparison: compareCandidate(candidate.rows, liveRows) })).sort((a, b) => b.comparison.score - a.comparison.score);
    const selected = ranked[0];
    const liveByName = new Map();
    for (const live of liveRows) {
      const key = normalizeName(live.name);
      liveByName.set(key, [...(liveByName.get(key) ?? []), live]);
    }
    let eligible = 0;
    let mismatched = 0;
    let plannedInserts = 0;
    for (const source of selected.rows) {
      const key = normalizeName(source.name);
      const matchingItems = itemByTypeAndName.get(`${type}|${key}`) ?? [];
      const matchingRows = liveByName.get(key) ?? [];
      const cachedItemId = resolvedItemIdByTypeAndName.get(`${type}|${key}`);
      const exactLiveRows = matchingRows.filter(row => source.issued === asNumber(row.issuedQtyGrams) && source.returned === asNumber(row.returnQtyGrams) && source.damage === asNumber(row.damageQtyGrams));
      let item = matchingItems.length === 1 ? matchingItems[0] : undefined;
      if (!item && cachedItemId) item = matchingItems.find(candidate => candidate.id === cachedItemId);
      if (!item && exactLiveRows.length === 1) item = matchingItems.find(candidate => candidate.id === exactLiveRows[0].itemId);
      if (!item && matchingRows.length === 1) item = matchingItems.find(candidate => candidate.id === matchingRows[0].itemId);
      if (!item) {
        plan.unresolved.push({ type, date, itemName: source.name, reason: matchingItems.length ? "ambiguous-item-name" : "missing-item" });
        continue;
      }
      resolvedItemIdByTypeAndName.set(`${type}|${key}`, item.id);
      if (matchingRows.length > 1) {
        const matchingItemRows = matchingRows.filter(row => row.itemId === item.id);
        if (matchingItemRows.length !== 1) {
          plan.unresolved.push({ type, date, itemId: item.id, itemName: source.name, reason: "ambiguous-live-operation" });
          continue;
        }
        matchingRows.length = 0;
        matchingRows.push(matchingItemRows[0]);
      }
      const priorClosing = priorSourceClosingByItemId.get(item.id);
      const openingOverrideQtyGrams = priorClosing === undefined || source.opening !== priorClosing ? source.opening : null;
      if (!matchingRows.length) {
        eligible += 1;
        plannedInserts += 1;
        plan.inserts.push({ itemId: item.id, type, date, itemName: source.name, openingOverrideQtyGrams, inOverrideQtyGrams: source.in, issuedQtyGrams: source.issued, returnQtyGrams: source.returned, damageQtyGrams: source.damage, note: source.note || null });
        priorSourceClosingByItemId.set(item.id, source.opening + source.in + source.returned - source.issued);
        continue;
      }
      const live = matchingRows[0];
      const quantitiesMatch = source.issued === asNumber(live.issuedQtyGrams) && source.returned === asNumber(live.returnQtyGrams) && source.damage === asNumber(live.damageQtyGrams);
      if (!quantitiesMatch) {
        mismatched += 1;
        plan.unresolved.push({ type, date, itemId: live.itemId, itemName: live.name, reason: "issued-return-damage-mismatch", source: { issued: source.issued, returned: source.returned, damage: source.damage }, live: { issued: asNumber(live.issuedQtyGrams), returned: asNumber(live.returnQtyGrams), damage: asNumber(live.damageQtyGrams) } });
        continue;
      }
      eligible += 1;
      if (!equalNullableNumber(live.openingOverrideQtyGrams, openingOverrideQtyGrams) || asNumber(live.inOverrideQtyGrams) !== source.in) plan.updates.push({ operationId: live.id, itemId: live.itemId, type, date, itemName: live.name, openingOverrideQtyGrams, inOverrideQtyGrams: source.in, note: source.note || null });
      priorSourceClosingByItemId.set(item.id, source.opening + source.in + source.returned - source.issued);
    }
    report.push({ type, date, source: path.basename(selected.file), liveRows: liveRows.length, sourceRows: selected.rows.length, matchedIssuedReturnDamage: selected.comparison.exact, mismatched, eligibleUpdates: eligible - plannedInserts, plannedInserts, candidateCount: candidates.length });
  }
}
const itemIdsWithUpdates = new Set([...plan.updates.map(update => update.itemId), ...plan.inserts.map(insert => insert.itemId)]);
for (const item of items.filter(item => itemIdsWithUpdates.has(item.id) && String(item.effectiveFrom).slice(0, 10) > start)) plan.effectiveFromUpdates.push({ itemId: item.id, itemName: item.name, itemType: item.itemType, effectiveFrom: start });
console.log(JSON.stringify({ report, summary: { plannedOperationUpdates: plan.updates.length, plannedOperationInserts: plan.inserts.length, plannedEffectiveFromUpdates: plan.effectiveFromUpdates.length, unresolved: plan.unresolved.length }, plan }, null, 2));
