import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
const statements = [
  `ALTER TABLE "recipes" ADD COLUMN IF NOT EXISTS "effectiveFrom" date NOT NULL DEFAULT DATE '1970-01-01'`,
  `ALTER TABLE "operations" ADD COLUMN IF NOT EXISTS "issuedOverrideQtyGrams" numeric(18, 6)`,
  `CREATE TABLE IF NOT EXISTS "orders" ("id" serial PRIMARY KEY NOT NULL, "orderDate" date NOT NULL, "salesItemId" integer NOT NULL REFERENCES "items"("id"), "quantity" numeric(18, 6) DEFAULT '0' NOT NULL, "note" text, "createdBy" integer REFERENCES "users"("id"), "createdAt" timestamptz DEFAULT now() NOT NULL, "updatedAt" timestamptz DEFAULT now() NOT NULL, CONSTRAINT "orders_date_sales_item_unique" UNIQUE("orderDate", "salesItemId"))`,
  `CREATE INDEX IF NOT EXISTS "orders_date_idx" ON "orders" ("orderDate")`,
];
try {
  for (const statement of statements) await pool.query(statement);
  console.log("Order migration applied to Supabase");
} finally {
  await pool.end();
}
