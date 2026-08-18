import { describe, expect, it } from "vitest";

describe("removed Gemini integration", () => {
  it("does not retain a usable Gemini credential", async () => {
    const apiKey = process.env.GEMINI_API_KEY ?? "";
    expect(apiKey).toBe("DISABLED");

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`);
    expect(response.ok).toBe(false);
    expect([400, 401, 403]).toContain(response.status);
  }, 20_000);
});

