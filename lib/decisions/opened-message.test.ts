import { describe, expect, it } from "vitest";
import { buildDecisionOpenedMessage } from "./opened-message";

describe("buildDecisionOpenedMessage", () => {
  it("announces the decision type and option count", () => {
    const msg = buildDecisionOpenedMessage({
      type: "DATES",
      options: [{ id: "a", label: "A" }, { id: "b", label: "B" }],
      deadline: null,
    });
    expect(msg).toBe("New vote: When are we going? — 2 options. Vote on Plan.");
  });

  it("singularizes a one-option decision", () => {
    const msg = buildDecisionOpenedMessage({ type: "CUSTOM", options: [{ id: "a", label: "A" }], deadline: null });
    expect(msg).toContain("1 option.");
  });

  it("appends a formatted deadline when one is set", () => {
    const msg = buildDecisionOpenedMessage({
      type: "DESTINATION",
      options: [{ id: "a", label: "A" }, { id: "b", label: "B" }, { id: "c", label: "C" }],
      deadline: "2026-11-20T18:00:00.000Z",
    });
    expect(msg).toContain("closes ");
    expect(msg).toContain("20");
  });
});
