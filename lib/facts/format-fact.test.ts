import { describe, expect, it } from "vitest";
import { formatFactValue } from "./format-fact";

describe("formatFactValue", () => {
  it("joins an items array (intake hard-no shape)", () => {
    expect(formatFactValue({ items: ["No overnight buses", "Back by Sunday"] })).toBe(
      "No overnight buses, Back by Sunday"
    );
  });

  it("joins a tags array (intake vibe shape)", () => {
    expect(formatFactValue({ tags: ["Beach", "Party"] })).toBe("Beach, Party");
  });

  it("reads a text field (Scribe extraction shape)", () => {
    expect(formatFactValue({ text: "Karan can't travel Nov 20-25" })).toBe("Karan can't travel Nov 20-25");
  });

  it("reads a city field", () => {
    expect(formatFactValue({ city: "Pune" })).toBe("Pune");
  });

  it("formats an amount field as currency", () => {
    expect(formatFactValue({ amount: 15000 })).toBe("₹15,000 a head");
  });

  it("falls back to a dash for an unrecognized shape", () => {
    expect(formatFactValue({ weird: true })).toBe("—");
  });
});
