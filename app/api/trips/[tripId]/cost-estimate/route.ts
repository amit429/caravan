import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/auth/session";
import { runCostEstimator } from "@/lib/agents/cost-estimator";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ tripId: string }> }
) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const { tripId } = await params;
  const result = await runCostEstimator(tripId);
  if (!result.ok) return NextResponse.json({ error: result.reason }, { status: 409 });
  return NextResponse.json({ ok: true }, { status: 201 });
}
