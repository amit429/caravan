import { describe, expect, it } from "vitest";
import { buildNudgeMessage } from "./nudge-message";

describe("buildNudgeMessage", () => {
  it("names everyone who hasn't booked yet", () => {
    expect(buildNudgeMessage("Flight to Goa", ["Rhea", "Sam"])).toBe(
      "Still waiting on Flight to Goa from Rhea, Sam."
    );
  });

  it("handles a single straggler", () => {
    expect(buildNudgeMessage("Hotel", ["Sam"])).toBe("Still waiting on Hotel from Sam.");
  });

  it("returns null when everyone has booked", () => {
    expect(buildNudgeMessage("Hotel", [])).toBeNull();
  });
});
