export const VISS_TO_GRAMS = 1632.93;

export type ItemType = "production" | "packaging" | "sales";
export type DisplayUnit = "g" | "pcs";
export type PurchaseUnit = "g" | "kg" | "viss" | "pcs";
export type InventoryUnit = "g" | "pcs";

export type OperationAmounts = {
  openingQtyGrams: number;
  inQtyGrams: number;
  issuedQtyGrams: number;
  returnQtyGrams: number;
  damageQtyGrams: number;
};

export function roundQuantity(value: number, precision = 6) {
  const multiplier = 10 ** precision;
  return Math.round((value + Number.EPSILON) * multiplier) / multiplier;
}

export function normalizePurchaseQuantity(
  quantity: number,
  unit: PurchaseUnit,
  gramsPerPiece: number,
) {
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error("Quantity must be greater than zero.");
  }

  const factors: Record<PurchaseUnit, number> = {
    g: 1,
    kg: 1000,
    viss: VISS_TO_GRAMS,
    pcs: gramsPerPiece,
  };
  const factor = factors[unit];

  if (!Number.isFinite(factor) || factor <= 0) {
    throw new Error("A positive grams-per-piece conversion is required for pieces.");
  }

  return roundQuantity(quantity * factor);
}

/**
 * Normalises a purchase to the item's actual inventory base unit.  Weight-based
 * items use grams; piece-based items remain pieces and are never converted.
 */
export function normalizePurchaseBaseQuantity(
  quantity: number,
  unit: PurchaseUnit,
  baseUnit: InventoryUnit,
) {
  if (baseUnit === "pcs") {
    if (unit !== "pcs") throw new Error("Piece-based inventory accepts pcs purchases only.");
    if (!Number.isFinite(quantity) || quantity <= 0) throw new Error("Quantity must be greater than zero.");
    return roundQuantity(quantity);
  }
  if (unit === "pcs") throw new Error("Weight-based inventory cannot accept pcs purchases.");
  return normalizePurchaseQuantity(quantity, unit, 1);
}

export function isItemEffectiveOnDate(
  businessDate: string,
  effectiveFrom: string,
  inactiveFrom?: string | null,
) {
  return businessDate >= effectiveFrom && (!inactiveFrom || businessDate < inactiveFrom);
}

export function resolveOperationIn(purchaseInQtyGrams: number, inOverrideQtyGrams?: number | null) {
  return inOverrideQtyGrams === null || inOverrideQtyGrams === undefined ? purchaseInQtyGrams : inOverrideQtyGrams;
}

export function calculateRecipeIssuedQuantity(orderQuantity: number, recipeOutputQuantity: number, componentQuantity: number) {
  if (!Number.isFinite(orderQuantity) || orderQuantity < 0) throw new Error("Order quantity cannot be negative.");
  if (!Number.isFinite(recipeOutputQuantity) || recipeOutputQuantity <= 0) throw new Error("Recipe output quantity must be positive.");
  if (!Number.isFinite(componentQuantity) || componentQuantity < 0) throw new Error("Recipe component quantity cannot be negative.");
  return roundQuantity(orderQuantity * componentQuantity / recipeOutputQuantity);
}

export function calculateOperationBalance(amounts: OperationAmounts) {
  const usedQtyGrams = roundQuantity(
    amounts.issuedQtyGrams - amounts.returnQtyGrams - amounts.damageQtyGrams,
  );
  const closingQtyGrams = roundQuantity(
    amounts.openingQtyGrams +
      amounts.inQtyGrams +
      amounts.returnQtyGrams -
      amounts.issuedQtyGrams,
  );

  return { usedQtyGrams, closingQtyGrams };
}

export function calculateSalesClosing(
  openingQtyGrams: number,
  produceQtyGrams: number,
  sellQtyGrams: number,
) {
  return roundQuantity(openingQtyGrams + produceQtyGrams - sellQtyGrams);
}

export function calculateMonthlyAverageCost(
  purchases: Array<{ quantityGrams: number; totalCost: number }>,
) {
  const totals = purchases.reduce(
    (accumulator, purchase) => ({
      quantityGrams: accumulator.quantityGrams + purchase.quantityGrams,
      totalCost: accumulator.totalCost + purchase.totalCost,
    }),
    { quantityGrams: 0, totalCost: 0 },
  );

  return totals.quantityGrams > 0 ? totals.totalCost / totals.quantityGrams : 0;
}

export function displayQuantity(quantityGrams: number, gramsPerDisplayUnit: number) {
  if (!Number.isFinite(gramsPerDisplayUnit) || gramsPerDisplayUnit <= 0) {
    return 0;
  }
  return roundQuantity(quantityGrams / gramsPerDisplayUnit);
}
