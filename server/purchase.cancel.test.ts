import { describe, expect, it } from "vitest";
import { purchaseStatus } from "../drizzle/schema";

describe("purchase cancellation status", () => {
  it("supports cancelled as a non-confirmed status", () => {
    expect(purchaseStatus.enumValues).toEqual(["draft", "confirmed", "cancelled"]);
    expect(purchaseStatus.enumValues.includes("cancelled")).toBe(true);
    expect("cancelled").not.toBe("confirmed");
  });
});
