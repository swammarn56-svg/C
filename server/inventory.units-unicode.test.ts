import { describe, expect, it } from "vitest";
import { normalizePurchaseBaseQuantity } from "../shared/inventory";
import { toUtf8BomCsv } from "../shared/spreadsheet";

describe("unit-aware inventory base quantities", () => {
  it("keeps Packaging and Sales pieces in pcs while retaining gram conversion for weights", () => {
    expect(normalizePurchaseBaseQuantity(500, "pcs", "pcs")).toBe(500);
    expect(normalizePurchaseBaseQuantity(2, "kg", "g")).toBe(2000);
    expect(() => normalizePurchaseBaseQuantity(1, "kg", "pcs")).toThrow("Piece-based inventory");
  });
});

describe("Myanmar Unicode CSV exchange", () => {
  it("writes a UTF-8 BOM CSV with Myanmar item, shop, and note text preserved", () => {
    const csv = toUtf8BomCsv([{ Name: "ပေါင်မုန့်", Shop: "ရန်ကုန်ဆိုင်", Note: "ချို" }]);
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain("ပေါင်မုန့်");
    expect(csv).toContain("ရန်ကုန်ဆိုင်");
    expect(csv).toContain("ချို");
  });
});
