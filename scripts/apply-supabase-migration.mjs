import { readFile } from "node:fs/promises";
import { Client } from "pg";

const connectionString = process.env.SUPABASE_DB_URL;
if (!connectionString) throw new Error("SUPABASE_DB_URL is required");

const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
const migrationFile = process.argv[2] ?? "0001_bakery_erp.sql";
await client.connect();
try {
  const sql = await readFile(new URL(`../supabase/migrations/${migrationFile}`, import.meta.url), "utf8");
  await client.query(sql);
  console.log(`Supabase migration ${migrationFile} applied successfully.`);
} finally {
  await client.end();
}
