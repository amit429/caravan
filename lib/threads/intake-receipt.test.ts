import { describe, expect, it } from "vitest";
import { buildIntakeReceipt } from "./intake-receipt";

describe("buildIntakeReceipt", () => {
  it("summarizes budget, city, and vibe", () => {
    const receipt = buildIntakeReceipt({
      budgetBand: "10-20k",
      departureCity: "Pune",
      vibe: ["Beach", "Trekking"],
      hardNos: [],
    });
    expect(receipt).toBe("Got it — 10-20k budget, from Pune, Beach + Trekking vibe.");
  });

  it("omits the vibe clause when nothing was picked", () => {
    const receipt = buildIntakeReceipt({
      budgetBand: "Open",
      departureCity: "Mumbai",
      vibe: [],
      hardNos: [],
    });
    expect(receipt).toBe("Got it — Open budget, from Mumbai.");
  });

  it("appends a hard-no count when present", () => {
    const receipt = buildIntakeReceipt({
      budgetBand: "20-35k",
      departureCity: "Delhi",
      vibe: ["Party"],
      hardNos: ["No overnight buses"],
    });
    expect(receipt).toBe("Got it — 20-35k budget, from Delhi, Party vibe. Filed 1 hard no too.");
  });

  it("pluralizes multiple hard nos", () => {
    const receipt = buildIntakeReceipt({
      budgetBand: "Under 10k",
      departureCity: "Goa",
      vibe: [],
      hardNos: ["No buses", "No shared rooms"],
    });
    expect(receipt).toBe("Got it — Under 10k budget, from Goa. Filed 2 hard nos too.");
  });
});
