import { describe, expect, it } from "vitest";
import {
  VISS_TO_GRAMS,
  calculateMonthlyAverageCost,
  calculateOperationBalance,
  calculateRecipeIssuedQuantity,
  resolveOperationIn,
  calculateSalesClosing,
  isItemEffectiveOnDate,
  normalizePurchaseQuantity,
} from "../shared/inventory";

describe("date-effective item lifecycle", () => {
  it("preserves records before a dated deletion and hides the item on and after its inactive date", () => {
    expect(isItemEffectiveOnDate("2026-06-17", "2026-06-01", "2026-06-18")).toBe(true);
    expect(isItemEffectiveOnDate("2026-06-18", "2026-06-01", "2026-06-18")).toBe(false);
  });

  it("does not show an item before its effective start date", () => {
    expect(isItemEffectiveOnDate("2026-06-15", "2026-06-16", null)).toBe(false);
    expect(isItemEffectiveOnDate("2026-06-16", "2026-06-16", null)).toBe(true);
  });
});

describe("purchase canonical quantities", () => {
  it("converts g, kg, viss, and pieces to canonical grams", () => {
    expect(normalizePurchaseQuantity(500, "g", 1)).toBe(500);
    expect(normalizePurchaseQuantity(2, "kg", 1)).toBe(2000);
    expect(VISS_TO_GRAMS).toBe(1600);
    expect(normalizePurchaseQuantity(1, "viss", 1)).toBe(1600);
    expect(normalizePurchaseQuantity(12, "pcs", 75)).toBe(900);
  });
});

describe("daily ledger formulas", () => {
  it("calculates Used and Closing from the specified Production or Packaging formula", () => {
    expect(calculateOperationBalance({ openingQtyGrams: 10000, inQtyGrams: 10000, issuedQtyGrams: 2000, returnQtyGrams: 5000, damageQtyGrams: 500 })).toEqual({ usedQtyGrams: -3500, closingQtyGrams: 23000 });
  });

  it("calculates the Sales closing balance", () => {
    expect(calculateSalesClosing(100, 80, 35)).toBe(145);
  });

  it("restores purchase-derived In after a manual override is cleared", () => {
    const purchaseIn = 500;
    const manualIn = 800;
    const manualDay = calculateOperationBalance({ openingQtyGrams: 0, inQtyGrams: manualIn, issuedQtyGrams: 100, returnQtyGrams: 0, damageQtyGrams: 0 });
    const resetDay = calculateOperationBalance({ openingQtyGrams: 0, inQtyGrams: purchaseIn, issuedQtyGrams: 100, returnQtyGrams: 0, damageQtyGrams: 0 });
    expect(manualDay.closingQtyGrams).toBe(700);
    expect(resetDay.closingQtyGrams).toBe(400);
  });

  it("clearing a saved manual In override restores later-day carryforward", () => {
    const purchaseInByDay = { day12: 500, day13: 0, day14: 0 };
    const manualInByDay = { day12: 800, day13: null, day14: null as number | null };
    const effectiveIn = (day: keyof typeof purchaseInByDay) => resolveOperationIn(purchaseInByDay[day], manualInByDay[day]);
    const day12AfterReset = calculateOperationBalance({ openingQtyGrams: 0, inQtyGrams: effectiveIn("day12"), issuedQtyGrams: 100, returnQtyGrams: 0, damageQtyGrams: 0 });
    const day13AfterReset = calculateOperationBalance({ openingQtyGrams: day12AfterReset.closingQtyGrams, inQtyGrams: effectiveIn("day13"), issuedQtyGrams: 20, returnQtyGrams: 0, damageQtyGrams: 0 });
    const day14AfterReset = calculateOperationBalance({ openingQtyGrams: day13AfterReset.closingQtyGrams, inQtyGrams: effectiveIn("day14"), issuedQtyGrams: 10, returnQtyGrams: 0, damageQtyGrams: 0 });
    manualInByDay.day12 = null;
    const resetDay12 = calculateOperationBalance({ openingQtyGrams: 0, inQtyGrams: effectiveIn("day12"), issuedQtyGrams: 100, returnQtyGrams: 0, damageQtyGrams: 0 });
    const resetDay13 = calculateOperationBalance({ openingQtyGrams: resetDay12.closingQtyGrams, inQtyGrams: effectiveIn("day13"), issuedQtyGrams: 20, returnQtyGrams: 0, damageQtyGrams: 0 });
    const resetDay14 = calculateOperationBalance({ openingQtyGrams: resetDay13.closingQtyGrams, inQtyGrams: effectiveIn("day14"), issuedQtyGrams: 10, returnQtyGrams: 0, damageQtyGrams: 0 });
    expect(day14AfterReset.closingQtyGrams).toBe(670);
    expect(resetDay12.closingQtyGrams).toBe(400);
    expect(resetDay14.closingQtyGrams).toBe(370);
  });

  it("carries an earlier corrected Closing into later Openings", () => {
    const day12 = calculateOperationBalance({ openingQtyGrams: 100, inQtyGrams: 50, issuedQtyGrams: 20, returnQtyGrams: 0, damageQtyGrams: 0 });
    const day13FromOriginal = calculateOperationBalance({ openingQtyGrams: day12.closingQtyGrams, inQtyGrams: 0, issuedQtyGrams: 10, returnQtyGrams: 0, damageQtyGrams: 0 });
    const correctedDay12 = calculateOperationBalance({ openingQtyGrams: 200, inQtyGrams: 50, issuedQtyGrams: 20, returnQtyGrams: 0, damageQtyGrams: 0 });
    const day13FromCorrection = calculateOperationBalance({ openingQtyGrams: correctedDay12.closingQtyGrams, inQtyGrams: 0, issuedQtyGrams: 10, returnQtyGrams: 0, damageQtyGrams: 0 });
    expect(day13FromOriginal.closingQtyGrams).toBe(120);
    expect(day13FromCorrection.closingQtyGrams).toBe(220);
  });
});

describe("recipe order issued quantities", () => {
  it("converts Sale-item order quantity into component Issued quantity", () => {
    expect(calculateRecipeIssuedQuantity(20, 1, 250)).toBe(5000);
    expect(calculateRecipeIssuedQuantity(10, 2, 400)).toBe(2000);
  });
  it("uses the recipe version effective on the order date without changing prior dates", () => {
    const versions = [{ effectiveFrom: "2026-06-01", componentQty: 100 }, { effectiveFrom: "2026-06-03", componentQty: 150 }];
    const forDate = (date: string) => versions.filter(version => version.effectiveFrom <= date).at(-1)!.componentQty;
    expect(calculateRecipeIssuedQuantity(10, 1, forDate("2026-06-02"))).toBe(1000);
    expect(calculateRecipeIssuedQuantity(10, 1, forDate("2026-06-03"))).toBe(1500);
  });
  it("keeps a manually edited Issued quantity over generated order quantity", () => {
    const generated = calculateRecipeIssuedQuantity(20, 1, 250);
    const manualOverride = 6000;
    expect(manualOverride).not.toBe(generated);
    expect(manualOverride).toBe(6000);
  });
});

describe("monthly purchase average cost", () => {
  it("uses only the supplied calendar month purchase rows", () => {
    const juneAverage = calculateMonthlyAverageCost([{ quantityGrams: 1000, totalCost: 2000 }, { quantityGrams: 3000, totalCost: 9000 }]);
    const julyAverage = calculateMonthlyAverageCost([{ quantityGrams: 2000, totalCost: 12000 }]);
    expect(juneAverage).toBe(2.75);
    expect(julyAverage).toBe(6);
  });
});

describe("non-destructive cross-module acceptance flow", () => {
  it("carries a dated item through canonical purchase quantity, ledger balances, sales closing, and month-scoped valuation", () => {
    expect(isItemEffectiveOnDate("2026-06-16", "2026-06-16", null)).toBe(true);
    const purchasedGrams = normalizePurchaseQuantity(3, "kg", 1);
    const operation = calculateOperationBalance({
      openingQtyGrams: 250,
      inQtyGrams: purchasedGrams,
      issuedQtyGrams: 1200,
      returnQtyGrams: 100,
      damageQtyGrams: 25,
    });
    const salesClosing = calculateSalesClosing(40, 80, 55);
    const juneCost = calculateMonthlyAverageCost([{ quantityGrams: purchasedGrams, totalCost: 9000 }]);

    expect(purchasedGrams).toBe(3000);
    expect(operation).toEqual({ usedQtyGrams: 1075, closingQtyGrams: 2150 });
    expect(salesClosing).toBe(65);
    expect(juneCost).toBe(3);
    expect(25 * juneCost).toBe(75);
  });
});
