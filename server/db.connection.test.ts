import { describe, expect, it } from "vitest";
import { getPostgresPoolOptions, normalizePostgresConnectionString } from "./db";

describe("normalizePostgresConnectionString", () => {
  it("removes conflicting SSL directives while preserving unrelated connection options", () => {
    const normalized = normalizePostgresConnectionString("postgresql://user:password@example.test:5432/postgres?sslmode=require&sslrootcert=ignored&application_name=bakery");
    const url = new URL(normalized);
    expect(url.searchParams.get("sslmode")).toBeNull();
    expect(url.searchParams.get("sslrootcert")).toBeNull();
    expect(url.searchParams.get("application_name")).toBe("bakery");
  });

  it("limits each serverless pool and releases idle sessions promptly", () => {
    const options = getPostgresPoolOptions("postgresql://user:password@example.test:5432/postgres?sslmode=require");
    expect(options.max).toBe(1);
    expect(options.idleTimeoutMillis).toBe(5_000);
    expect(options.connectionTimeoutMillis).toBe(10_000);
    expect(options.ssl).toEqual({ rejectUnauthorized: false });
    expect(new URL(options.connectionString).searchParams.get("sslmode")).toBeNull();
  });
});
