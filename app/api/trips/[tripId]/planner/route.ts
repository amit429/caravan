import { NextResponse } from "next/server";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { requireTripOwner } from "@/lib/auth/resolve-caller";
import { runPlanner } from "@/lib/agents/planner";

// Admin-triggered, same as Scout — Concierge deciding when destination-lock
// should auto-fire this is deferred (no orchestration layer built yet).
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ tripId: string }> }
) {
  const { tripId } = await params;
  const supabase = createServiceSupabaseClient();
  const owner = await requireTripOwner(tripId, supabase);
  if ("error" in owner) return owner.error;

  const result = await runPlanner(tripId);
  if (!result.ok) return NextResponse.json({ error: result.reason }, { status: 409 });
  return NextResponse.json({ ok: true }, { status: 201 });
}
