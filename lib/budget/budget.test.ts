import { describe, expect, it } from "vitest";
import { groupBudgetCeiling } from "./budget";

describe("groupBudgetCeiling", () => {
  it("is the tightest submitted ceiling, since that's who the plan has to fit", () => {
    expect(groupBudgetCeiling([15000, 35000, 8000])).toBe(8000);
  });

  it("returns null when nobody has submitted a budget yet", () => {
    expect(groupBudgetCeiling([])).toBeNull();
  });
});
