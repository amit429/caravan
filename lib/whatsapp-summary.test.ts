import { describe, expect, it } from "vitest";
import { buildTripSummary } from "./whatsapp-summary";

describe("buildTripSummary", () => {
  it("includes every line when all data is present", () => {
    const summary = buildTripSummary({
      tripName: "Goa Trip",
      destinationLabel: "Goa",
      datesLabel: "Nov 12 – Nov 15",
      groupCeiling: 20000,
      checklist: { done: 4, total: 12 },
      inviteUrl: "https://caravan.app/join/ABC123",
    });
    expect(summary).toBe(
      [
        "🧭 *Goa Trip*",
        "📍 Goa",
        "📅 Nov 12 – Nov 15",
        "💰 Under ₹20,000/head",
        "✅ 4/12 prepped",
        "👉 https://caravan.app/join/ABC123",
      ].join("\n")
    );
  });

  it("omits lines for data that isn't decided yet", () => {
    const summary = buildTripSummary({
      tripName: "Untitled Trip",
      destinationLabel: null,
      datesLabel: null,
      groupCeiling: null,
      checklist: null,
      inviteUrl: "https://caravan.app/join/XYZ999",
    });
    expect(summary).toBe(["🧭 *Untitled Trip*", "👉 https://caravan.app/join/XYZ999"].join("\n"));
  });
});
