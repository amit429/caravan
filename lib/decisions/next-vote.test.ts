import { describe, expect, it } from "vitest";
import { nextVoteAction } from "./next-vote";

describe("nextVoteAction", () => {
  it("votes for an option when there's no current vote", () => {
    expect(nextVoteAction(null, "a", false)).toEqual({ optionId: "a", isVeto: false });
  });

  it("vetoes an option when there's no current vote", () => {
    expect(nextVoteAction(null, "a", true)).toEqual({ optionId: "a", isVeto: true });
  });

  it("removes the vote when clicking Vote again on the same option", () => {
    expect(nextVoteAction({ optionId: "a", isVeto: false }, "a", false)).toBeNull();
  });

  it("removes the veto when clicking Veto again on the same option", () => {
    expect(nextVoteAction({ optionId: "a", isVeto: true }, "a", true)).toBeNull();
  });

  it("switches a plain vote to a veto on the same option", () => {
    expect(nextVoteAction({ optionId: "a", isVeto: false }, "a", true)).toEqual({ optionId: "a", isVeto: true });
  });

  it("switches a veto to a plain vote on the same option", () => {
    expect(nextVoteAction({ optionId: "a", isVeto: true }, "a", false)).toEqual({ optionId: "a", isVeto: false });
  });

  it("moves the vote to a different option", () => {
    expect(nextVoteAction({ optionId: "a", isVeto: false }, "b", false)).toEqual({ optionId: "b", isVeto: false });
  });

  it("moves a veto to a different option as a plain vote", () => {
    expect(nextVoteAction({ optionId: "a", isVeto: true }, "b", false)).toEqual({ optionId: "b", isVeto: false });
  });
});
