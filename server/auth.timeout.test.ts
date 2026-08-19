import { describe, expect, it, vi } from "vitest";
import { withAuthTimeout } from "../client/src/_core/hooks/useAuth";

describe("authentication timeout handling", () => {
  it("resolves a completed auth request", async () => {
    await expect(withAuthTimeout(Promise.resolve({ ok: true }), "timed out", 50)).resolves.toEqual({ ok: true });
  });

  it("rejects a stalled auth request within the configured bound", async () => {
    vi.useFakeTimers();
    try {
      const pending = new Promise<never>(() => undefined);
      const result = withAuthTimeout(pending, "Sign-in timed out", 100);
      const assertion = expect(result).rejects.toThrow("Sign-in timed out");
      await vi.advanceTimersByTimeAsync(100);
      await assertion;
    } finally {
      vi.useRealTimers();
    }
  });

  it("bounds a stalled Supabase session installation", async () => {
    vi.useFakeTimers();
    try {
      const stalledSetSession = new Promise<never>(() => undefined);
      const result = withAuthTimeout(stalledSetSession, "Session installation timed out", 100);
      const assertion = expect(result).rejects.toThrow("Session installation timed out");
      await vi.advanceTimersByTimeAsync(100);
      await assertion;
    } finally {
      vi.useRealTimers();
    }
  });
});
