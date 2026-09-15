import { describe, expect, it } from "vitest";
import { generateInviteCode } from "./invite-code";

describe("generateInviteCode", () => {
  it("returns 6 characters", () => {
    expect(generateInviteCode()).toHaveLength(6);
  });

  it("only uses unambiguous uppercase alphanumerics", () => {
    const code = generateInviteCode();
    expect(code).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/);
  });

  it("is not deterministic across calls", () => {
    const codes = new Set(Array.from({ length: 20 }, () => generateInviteCode()));
    expect(codes.size).toBeGreaterThan(1);
  });
});
