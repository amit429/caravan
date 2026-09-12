import { SignJWT, jwtVerify } from "jose";

const ONE_HUNDRED_EIGHTY_DAYS = 60 * 60 * 24 * 180;

function getSecretKey() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not set");
  return new TextEncoder().encode(secret);
}

export async function signMemberToken({
  tripId,
  memberId,
}: {
  tripId: string;
  memberId: string;
}): Promise<string> {
  return new SignJWT({ tripId, memberId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${ONE_HUNDRED_EIGHTY_DAYS}s`)
    .sign(getSecretKey());
}

export async function verifyMemberToken(
  token: string
): Promise<{ tripId: string; memberId: string } | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    if (typeof payload.tripId !== "string" || typeof payload.memberId !== "string") {
      return null;
    }
    return { tripId: payload.tripId, memberId: payload.memberId };
  } catch {
    return null;
  }
}
