import { describe, expect, it } from "vitest";
import { filterReportRowsByItem, resolveReportPeriod } from "../shared/reporting";

describe("item report filtering", () => {
  const rows = [
    { item: { id: 1 }, value: 10 },
    { item: { id: 2 }, value: 20 },
    { item: { id: 3 }, value: 30 },
  ];

  it("keeps all rows when no item is selected", () => {
    expect(filterReportRowsByItem(rows, "")).toEqual(rows);
  });

  it("returns only the selected item row", () => {
    expect(filterReportRowsByItem(rows, "2")).toEqual([{ item: { id: 2 }, value: 20 }]);
  });
});

describe("report period selection", () => {
  it("uses the global business date for daily reports", () => {
    expect(resolveReportPeriod("daily", "2026-08-16", "2026-08-01", "2026-08-15")).toEqual({ from: "2026-08-16", to: "2026-08-16" });
  });

  it("preserves explicit dates for range reports", () => {
    expect(resolveReportPeriod("range", "2026-08-16", "2026-08-01", "2026-08-15")).toEqual({ from: "2026-08-01", to: "2026-08-15" });
  });
});
