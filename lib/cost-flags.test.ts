import { describe, expect, it } from "vitest";
import { flagMembersOverBudget } from "./cost-flags";

describe("flagMembersOverBudget", () => {
  it("flags members whose ceiling is below the estimate's upper bound", () => {
    const flagged = flagMembersOverBudget(20000, [
      { memberId: "m1", ceiling: 25000 },
      { memberId: "m2", ceiling: 15000 },
      { memberId: "m3", ceiling: 20000 },
    ]);
    expect(flagged).toEqual(["m2"]);
  });

  it("returns an empty array when everyone's ceiling covers the estimate", () => {
    expect(flagMembersOverBudget(10000, [{ memberId: "m1", ceiling: 15000 }])).toEqual([]);
  });

  it("returns an empty array when there are no budget facts yet", () => {
    expect(flagMembersOverBudget(10000, [])).toEqual([]);
  });
});
