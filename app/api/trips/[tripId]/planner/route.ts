import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/auth/session";
import { runPlanner } from "@/lib/agents/planner";

// Admin-triggered, same as Scout — Concierge deciding when destination-lock
// should auto-fire this is deferred (no orchestration layer built yet).
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ tripId: string }> }
) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const { tripId } = await params;
  const result = await runPlanner(tripId);
  if (!result.ok) return NextResponse.json({ error: result.reason }, { status: 409 });
  return NextResponse.json({ ok: true }, { status: 201 });
}
