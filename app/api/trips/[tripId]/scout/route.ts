import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/auth/session";
import { runScout } from "@/lib/agents/scout";

// Admin-triggered for now — Concierge deciding *when* the group has talked
// enough to fire Scout automatically is deferred until Chaser/cron exist.
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ tripId: string }> }
) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const { tripId } = await params;
  const result = await runScout(tripId);
  if (!result.ok) return NextResponse.json({ error: result.reason }, { status: 409 });
  return NextResponse.json({ ok: true }, { status: 201 });
}
