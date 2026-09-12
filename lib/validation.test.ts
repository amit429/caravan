import { describe, expect, it } from "vitest";
import { createTripSchema, joinTripSchema } from "./validation";

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
