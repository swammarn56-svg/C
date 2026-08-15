import { describe, expect, it } from "vitest";
import {
  VISS_TO_GRAMS,
  calculateMonthlyAverageCost,
  calculateOperationBalance,
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
    expect(normalizePurchaseQuantity(1, "viss", 1)).toBe(VISS_TO_GRAMS);
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

  it("carries an earlier corrected Closing into later Openings", () => {
    const day12 = calculateOperationBalance({ openingQtyGrams: 100, inQtyGrams: 50, issuedQtyGrams: 20, returnQtyGrams: 0, damageQtyGrams: 0 });
    const day13FromOriginal = calculateOperationBalance({ openingQtyGrams: day12.closingQtyGrams, inQtyGrams: 0, issuedQtyGrams: 10, returnQtyGrams: 0, damageQtyGrams: 0 });
    const correctedDay12 = calculateOperationBalance({ openingQtyGrams: 200, inQtyGrams: 50, issuedQtyGrams: 20, returnQtyGrams: 0, damageQtyGrams: 0 });
    const day13FromCorrection = calculateOperationBalance({ openingQtyGrams: correctedDay12.closingQtyGrams, inQtyGrams: 0, issuedQtyGrams: 10, returnQtyGrams: 0, damageQtyGrams: 0 });
    expect(day13FromOriginal.closingQtyGrams).toBe(120);
    expect(day13FromCorrection.closingQtyGrams).toBe(220);
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
