import { NextResponse } from "next/server";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { requireTripOwner } from "@/lib/auth/resolve-caller";
import { runScout } from "@/lib/agents/scout";

// Admin-triggered for now — Concierge deciding *when* the group has talked
// enough to fire Scout automatically is deferred until Chaser/cron exist.
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ tripId: string }> }
) {
  const { tripId } = await params;
  const supabase = createServiceSupabaseClient();
  const owner = await requireTripOwner(tripId, supabase);
  if ("error" in owner) return owner.error;

  const result = await runScout(tripId);
  if (!result.ok) return NextResponse.json({ error: result.reason }, { status: 409 });
  return NextResponse.json({ ok: true }, { status: 201 });
}
