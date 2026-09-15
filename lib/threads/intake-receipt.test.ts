import { describe, expect, it } from "vitest";
import { buildIntakeReceipt } from "./intake-receipt";

describe("buildIntakeReceipt", () => {
  it("summarizes budget, city, and vibe", () => {
    const receipt = buildIntakeReceipt({
      budgetAmount: 15000,
      departureCity: "Pune",
      vibe: ["Beach", "Trekking"],
      hardNos: [],
    });
    expect(receipt).toBe("Got it — ₹15,000 budget, from Pune, Beach + Trekking vibe.");
  });

  it("omits the vibe clause when nothing was picked", () => {
    const receipt = buildIntakeReceipt({
      budgetAmount: 50000,
      departureCity: "Mumbai",
      vibe: [],
      hardNos: [],
    });
    expect(receipt).toBe("Got it — ₹50,000 budget, from Mumbai.");
  });

  it("appends a hard-no count when present", () => {
    const receipt = buildIntakeReceipt({
      budgetAmount: 30000,
      departureCity: "Delhi",
      vibe: ["Party"],
      hardNos: ["No overnight buses"],
    });
    expect(receipt).toBe("Got it — ₹30,000 budget, from Delhi, Party vibe. Filed 1 hard no too.");
  });

  it("pluralizes multiple hard nos", () => {
    const receipt = buildIntakeReceipt({
      budgetAmount: 8000,
      departureCity: "Goa",
      vibe: [],
      hardNos: ["No buses", "No shared rooms"],
    });
    expect(receipt).toBe("Got it — ₹8,000 budget, from Goa. Filed 2 hard nos too.");
  });
});
