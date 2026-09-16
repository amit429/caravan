import { describe, expect, it } from "vitest";
import { flagMembersOverBudget, budgetCheckThreshold } from "./cost-flags";

describe("budgetCheckThreshold", () => {
  it("is the midpoint of the estimate's range", () => {
    expect(budgetCheckThreshold({ minPerHead: 50000, maxPerHead: 90000 })).toBe(70000);
  });
});

describe("flagMembersOverBudget", () => {
  it("flags members whose ceiling is below the estimate's midpoint, not just its upper bound", () => {
    // Midpoint of 10000-30000 is 20000 — m2 (25000) clears the realistic
    // midpoint even though it's below the pessimistic max, so it should NOT
    // be flagged (the literal bug this fixes: comparing against max flagged
    // nearly everyone whenever the range was wide).
    const flagged = flagMembersOverBudget({ minPerHead: 10000, maxPerHead: 30000 }, [
      { memberId: "m1", ceiling: 15000 },
      { memberId: "m2", ceiling: 25000 },
      { memberId: "m3", ceiling: 20000 },
    ]);
    expect(flagged).toEqual(["m1"]);
  });

  it("returns an empty array when everyone's ceiling covers the midpoint", () => {
    expect(flagMembersOverBudget({ minPerHead: 8000, maxPerHead: 12000 }, [{ memberId: "m1", ceiling: 15000 }])).toEqual([]);
  });

  it("returns an empty array when there are no budget facts yet", () => {
    expect(flagMembersOverBudget({ minPerHead: 8000, maxPerHead: 12000 }, [])).toEqual([]);
  });
});
