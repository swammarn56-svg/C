import { describe, expect, it } from "vitest";
import { Client } from "pg";

describe("Supabase credentials", () => {
  it("authenticates the configured server credential against the REST endpoint", async () => {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    expect(url, "SUPABASE_URL must be configured").toMatch(/^https:\/\//);
    expect(key, "SUPABASE_SERVICE_ROLE_KEY must be configured").toBeTruthy();

    const response = await fetch(`${url}/rest/v1/`, {
      headers: {
        apikey: key!,
        Authorization: `Bearer ${key!}`,
      },
    });

    expect(await response.text()).not.toContain("Invalid API key");
    expect(response.ok, "Supabase REST endpoint should accept the configured server credential").toBe(true);
  }, 15_000);

  it("connects to the configured Supabase PostgreSQL database", async () => {
    const connectionString = process.env.SUPABASE_DB_URL;
    expect(connectionString, "SUPABASE_DB_URL must be configured").toMatch(/^postgres(?:ql)?:\/\//);

    const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
    await client.connect();
    try {
      const result = await client.query<{ connected: number }>("select 1 as connected");
      expect(result.rows[0]?.connected).toBe(1);
    } finally {
      await client.end();
    }
  }, 15_000);
});
