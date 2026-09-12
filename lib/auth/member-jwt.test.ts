import { describe, expect, it, beforeAll } from "vitest";
import { signMemberToken, verifyMemberToken } from "./member-jwt";

beforeAll(() => {
  process.env.JWT_SECRET = "test-secret-at-least-32-bytes-long!!";
});

describe("member JWT", () => {
  it("round-trips tripId and memberId", async () => {
    const token = await signMemberToken({ tripId: "trip-1", memberId: "member-1" });
    const claims = await verifyMemberToken(token);
    expect(claims).toEqual({ tripId: "trip-1", memberId: "member-1" });
  });

  it("returns null for a garbage token", async () => {
    expect(await verifyMemberToken("not-a-jwt")).toBeNull();
  });

  it("returns null for a token signed with a different secret", async () => {
    const token = await signMemberToken({ tripId: "trip-1", memberId: "member-1" });
    process.env.JWT_SECRET = "a-completely-different-secret-value";
    expect(await verifyMemberToken(token)).toBeNull();
  });
});
