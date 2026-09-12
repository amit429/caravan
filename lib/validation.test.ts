import { describe, expect, it } from "vitest";
import { createTripSchema, joinTripSchema, intakeSchema } from "./validation";

describe("createTripSchema", () => {
  it("accepts a minimal valid trip", () => {
    const result = createTripSchema.safeParse({ name: "Goa, probably" });
    expect(result.success).toBe(true);
  });

  it("rejects an empty name", () => {
    const result = createTripSchema.safeParse({ name: "" });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid agent_tone", () => {
    const result = createTripSchema.safeParse({ name: "Goa", agentTone: "sarcastic" });
    expect(result.success).toBe(false);
  });
});

describe("joinTripSchema", () => {
  it("accepts a valid name and email", () => {
    const result = joinTripSchema.safeParse({ displayName: "Ishaan", email: "ishaan@example.com" });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid email", () => {
    const result = joinTripSchema.safeParse({ displayName: "Ishaan", email: "not-an-email" });
    expect(result.success).toBe(false);
  });
});

describe("intakeSchema", () => {
  const valid = {
    availability: [{ startDate: "2026-11-01", endDate: "2026-11-10", strength: "free" }],
    budgetBand: "10-20k",
    departureCity: "Pune",
    vibe: ["Beach", "Food"],
    hardNos: ["No overnight buses"],
  };

  it("accepts a fully filled intake", () => {
    expect(intakeSchema.safeParse(valid).success).toBe(true);
  });

  it("accepts vibe and hardNos defaulting to empty", () => {
    const { vibe: _vibe, hardNos: _hardNos, ...rest } = valid;
    const result = intakeSchema.safeParse(rest);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.vibe).toEqual([]);
      expect(result.data.hardNos).toEqual([]);
    }
  });

  it("rejects a malformed date", () => {
    const result = intakeSchema.safeParse({
      ...valid,
      availability: [{ startDate: "11/01/2026", endDate: "2026-11-10", strength: "free" }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid strength value", () => {
    const result = intakeSchema.safeParse({
      ...valid,
      availability: [{ startDate: "2026-11-01", endDate: "2026-11-10", strength: "kinda" }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects zero availability windows", () => {
    const result = intakeSchema.safeParse({ ...valid, availability: [] });
    expect(result.success).toBe(false);
  });
});
