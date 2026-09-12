import { describe, expect, it } from "vitest";
import { budgetBandCeiling, groupBudgetCeiling } from "./budget";

describe("budgetBandCeiling", () => {
  it("maps known bands to their upper bound in INR", () => {
    expect(budgetBandCeiling("Under 10k")).toBe(10000);
    expect(budgetBandCeiling("10-20k")).toBe(20000);
    expect(budgetBandCeiling("20-35k")).toBe(35000);
  });

  it("treats Open as unbounded", () => {
    expect(budgetBandCeiling("Open")).toBeNull();
  });

  it("returns null for an unrecognized band", () => {
    expect(budgetBandCeiling("a lot")).toBeNull();
  });
});

describe("groupBudgetCeiling", () => {
  it("is the tightest submitted ceiling, since that's who the plan has to fit", () => {
    expect(groupBudgetCeiling(["10-20k", "20-35k", "Under 10k"])).toBe(10000);
  });

  it("ignores Open and unrecognized bands when a real ceiling exists", () => {
    expect(groupBudgetCeiling(["Open", "20-35k"])).toBe(35000);
  });

  it("returns null when nobody has a bounded budget yet", () => {
    expect(groupBudgetCeiling(["Open", "Open"])).toBeNull();
    expect(groupBudgetCeiling([])).toBeNull();
  });
});
