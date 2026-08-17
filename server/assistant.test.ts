import { describe, expect, it } from "vitest";
import { matchEllaItems, normalizeEllaText, resolveEllaDateRange } from "../shared/ella";

describe("Ella read-only intent helpers", () => {
  const items = [
    { id: 1, name: "ဂျုံ", itemType: "production", displayUnit: "g" },
    { id: 2, name: "ဂျုံကြမ်း", itemType: "production", displayUnit: "g" },
    { id: 3, name: "Bread", itemType: "sales", displayUnit: "pcs" },
  ];

  it("normalizes Myanmar names without changing Unicode content", () => {
    expect(normalizeEllaText(" ဂျုံ ")).toBe(normalizeEllaText("ဂျုံ"));
  });

  it("matches an exact Myanmar item before partial matches", () => {
    expect(matchEllaItems(items, "ဂျုံ").map(item => item.id)).toEqual([1]);
  });

  it("returns ambiguous candidates instead of guessing", () => {
    const similar = [items[1], { id: 4, name: "ဂျုံမှုန့်", itemType: "production", displayUnit: "g" }];
    expect(matchEllaItems(similar, "ဂျုံ").map(item => item.id)).toEqual([2, 4]);
  });

  it("uses the global date for current-day closing questions", () => {
    expect(resolveEllaDateRange("closing", "2026-08-17")).toEqual({ from: "2026-08-17", to: "2026-08-17" });
  });

  it("uses the first day of the current month for period totals", () => {
    expect(resolveEllaDateRange("used_total", "2026-08-17")).toEqual({ from: "2026-08-01", to: "2026-08-17" });
  });

  it("preserves explicit question date ranges", () => {
    expect(resolveEllaDateRange("purchase_total", "2026-08-17", "2026-07-01", "2026-07-31")).toEqual({ from: "2026-07-01", to: "2026-07-31" });
  });
});
