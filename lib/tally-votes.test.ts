import { describe, expect, it } from "vitest";
import { tallyVotes, pickWinningOption } from "./tally-votes";

describe("tallyVotes", () => {
  it("counts votes per option and tracks which options carry a veto", () => {
    const result = tallyVotes([
      { option_id: "goa", is_veto: false },
      { option_id: "goa", is_veto: false },
      { option_id: "manali", is_veto: true },
    ]);
    expect(result.counts.get("goa")).toBe(2);
    expect(result.counts.get("manali")).toBe(1);
    expect(result.vetoedOptions.has("manali")).toBe(true);
    expect(result.vetoedOptions.has("goa")).toBe(false);
  });
});

describe("pickWinningOption", () => {
  const options = [
    { id: "goa", label: "Goa" },
    { id: "manali", label: "Manali" },
    { id: "gokarna", label: "Gokarna" },
  ];

  it("picks the option with the most votes", () => {
    const votes = [
      { option_id: "goa", is_veto: false },
      { option_id: "goa", is_veto: false },
      { option_id: "manali", is_veto: false },
    ];
    expect(pickWinningOption(options, votes)).toBe("goa");
  });

  it("skips a vetoed option even if it has the most votes", () => {
    const votes = [
      { option_id: "goa", is_veto: false },
      { option_id: "goa", is_veto: false },
      { option_id: "goa", is_veto: true },
      { option_id: "manali", is_veto: false },
    ];
    expect(pickWinningOption(options, votes)).toBe("manali");
  });

  it("returns null when every option with any votes is vetoed", () => {
    const votes = [
      { option_id: "goa", is_veto: true },
      { option_id: "manali", is_veto: true },
    ];
    expect(pickWinningOption(options, votes)).toBeNull();
  });

  it("returns null when there are no votes at all", () => {
    expect(pickWinningOption(options, [])).toBeNull();
  });
});
