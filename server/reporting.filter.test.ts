import { describe, expect, it } from "vitest";
import { filterReportRowsByItem } from "../shared/reporting";

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
