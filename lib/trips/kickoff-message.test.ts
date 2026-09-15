import { describe, expect, it } from "vitest";
import { buildKickoffMessage } from "./kickoff-message";

describe("buildKickoffMessage", () => {
  it("leads with the rough intent when one was given", () => {
    const msg = buildKickoffMessage({ rough_intent: "Long weekend, beaches, nothing over-planned", vibe: [], budget_hint: null });
    expect(msg).toContain("Right — Long weekend, beaches, nothing over-planned.");
    expect(msg).toContain("five questions in your own thread");
  });

  it("appends the budget hint to the intent when both are set", () => {
    const msg = buildKickoffMessage({ rough_intent: "Beachy long weekend", vibe: [], budget_hint: "10-20k" });
    expect(msg).toContain("Right — Beachy long weekend, 10-20k a head.");
  });

  it("falls back to the vibe tags when there's no rough intent", () => {
    const msg = buildKickoffMessage({ rough_intent: null, vibe: ["Beach", "Party"], budget_hint: "10-20k" });
    expect(msg).toContain("Right — something beach, party, 10-20k a head.");
  });

  it("falls back to a generic line when nothing was set at creation", () => {
    const msg = buildKickoffMessage({ rough_intent: null, vibe: [], budget_hint: null });
    expect(msg).toContain("Right — a trip.");
  });
});
