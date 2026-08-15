import fs from "node:fs";
import path from "node:path";
import { Pool } from "pg";
import XLSX from "xlsx";

const uploadDir = "/home/ubuntu/upload";
const start = "2026-08-01";
const end = "2026-08-14";

function normalizeName(value) {
  return String(value ?? "").normalize("NFC").replace(/[\u200B-\u200D\uFEFF]/g, "").trim().toLocaleLowerCase();
}

function asNumber(value) {
  const parsed = Number(String(value ?? "").replaceAll(",", "").trim());
  return Number.isFinite(parsed) ? parsed : 0;
}

function toIsoDate(value) {
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
}

function normalizeConnectionString(connectionString) {
  const url = new URL(connectionString);
  ["sslmode", "sslrootcert", "sslcert", "sslkey"].forEach(key => url.searchParams.delete(key));
  return url.toString();
}

function sourceCandidates(type, date) {
  const escaped = date.replaceAll("-", "-");
  const prefix = `${type}-${escaped}`;
  return fs.readdirSync(uploadDir)
    .filter(name => name.toLowerCase().endsWith(".csv") && name.toLowerCase().startsWith(prefix))
    .map(name => path.join(uploadDir, name));
}

function readRows(file) {
  const workbook = XLSX.readFile(file, { raw: false });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json(sheet, { defval: "" }).map(row => ({
    name: String(row["Item Name"] ?? ""),
    opening: asNumber(row.Opening),
    in: asNumber(row.In),
    issued: asNumber(row.Issued),
    returned: asNumber(row.Return),
    damage: asNumber(row.Damage),
    note: String(row.Note ?? ""),
  })).filter(row => row.name.trim());
}

function compareCandidate(candidateRows, liveRows) {
  const sourceByName = new Map(candidateRows.map(row => [normalizeName(row.name), row]));
  const liveByName = new Map(liveRows.map(row => [normalizeName(row.name), row]));
  let overlap = 0;
  let exact = 0;
  let mismatches = 0;
  for (const [name, live] of liveByName) {
    const source = sourceByName.get(name);
    if (!source) continue;
    overlap += 1;
    const matches = source.issued === asNumber(live.issuedQtyGrams) && source.returned === asNumber(live.returnQtyGrams) && source.damage === asNumber(live.damageQtyGrams);
    if (matches) exact += 1;
    else mismatches += 1;
  }
  return { overlap, exact, mismatches, score: exact * 1000 + overlap * 10 - mismatches };
}

const connectionString = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
if (!connectionString) throw new Error("SUPABASE_DB_URL or DATABASE_URL is required for read-only reconciliation.");

  const pool = new Pool({ connectionString: normalizeConnectionString(connectionString), ssl: { rejectUnauthorized: false }, max: 1, idleTimeoutMillis: 5_000, connectionTimeoutMillis: 10_000 });
try {
  const [itemsResult, operationsResult] = await Promise.all([
    pool.query(`select id, name, "itemType", "effectiveFrom"::text as "effectiveFrom" from items where "itemType" in ('production', 'packaging') order by id`),
    pool.query(`select o.id, o."itemId", o."operationType", o."operationDate"::text as "operationDate", o."issuedQtyGrams", o."returnQtyGrams", o."damageQtyGrams", o."openingOverrideQtyGrams", o."inOverrideQtyGrams", o.note from operations o where o."operationDate" >= $1::date and o."operationDate" <= $2::date order by o."operationDate", o."itemId"`, [start, end]),
  ]);
  const items = itemsResult.rows;
  const itemById = new Map(items.map(item => [item.id, item]));
  const report = [];
  const plan = { generatedAt: new Date().toISOString(), range: { start, end }, updates: [], effectiveFromUpdates: [], unresolved: [] };

  for (const type of ["production", "packaging"]) {
    for (let day = 1; day <= 14; day += 1) {
      const date = `2026-08-${String(day).padStart(2, "0")}`;
      const liveRows = operationsResult.rows.filter(row => row.operationType === type && toIsoDate(row.operationDate) === date).map(row => ({ ...row, name: itemById.get(row.itemId)?.name ?? `missing-item-${row.itemId}` }));
      const candidates = sourceCandidates(type, date).map(file => ({ file, rows: readRows(file) }));
      if (!candidates.length) {
        report.push({ type, date, status: "missing-source" });
        continue;
      }
      const ranked = candidates.map(candidate => ({ ...candidate, comparison: compareCandidate(candidate.rows, liveRows) })).sort((a, b) => b.comparison.score - a.comparison.score);
      const selected = ranked[0];
      const sourceByName = new Map(selected.rows.map(row => [normalizeName(row.name), row]));
      let eligible = 0;
      let mismatched = 0;
      for (const live of liveRows) {
        const source = sourceByName.get(normalizeName(live.name));
        if (!source) continue;
        const quantitiesMatch = source.issued === asNumber(live.issuedQtyGrams) && source.returned === asNumber(live.returnQtyGrams) && source.damage === asNumber(live.damageQtyGrams);
        if (!quantitiesMatch) {
          mismatched += 1;
          plan.unresolved.push({ type, date, itemId: live.itemId, itemName: live.name, reason: "issued-return-damage-mismatch", source: { issued: source.issued, returned: source.returned, damage: source.damage }, live: { issued: asNumber(live.issuedQtyGrams), returned: asNumber(live.returnQtyGrams), damage: asNumber(live.damageQtyGrams) } });
          continue;
        }
        eligible += 1;
        if (asNumber(live.openingOverrideQtyGrams) !== source.opening || asNumber(live.inOverrideQtyGrams) !== source.in) {
          plan.updates.push({ operationId: live.id, itemId: live.itemId, type, date, itemName: live.name, openingOverrideQtyGrams: source.opening, inOverrideQtyGrams: source.in, note: source.note || null });
        }
      }
      report.push({ type, date, source: path.basename(selected.file), liveRows: liveRows.length, sourceRows: selected.rows.length, matchedIssuedReturnDamage: selected.comparison.exact, mismatched, eligibleUpdates: eligible, candidateCount: candidates.length });
    }
  }

  const itemIdsWithUpdates = new Set(plan.updates.map(update => update.itemId));
  for (const item of items.filter(item => itemIdsWithUpdates.has(item.id) && toIsoDate(item.effectiveFrom) > start)) {
    plan.effectiveFromUpdates.push({ itemId: item.id, itemName: item.name, itemType: item.itemType, effectiveFrom: start });
  }

  console.log(JSON.stringify({ report, summary: { plannedOperationUpdates: plan.updates.length, plannedEffectiveFromUpdates: plan.effectiveFromUpdates.length, unresolved: plan.unresolved.length }, plan }, null, 2));
} finally {
  await pool.end();
}
