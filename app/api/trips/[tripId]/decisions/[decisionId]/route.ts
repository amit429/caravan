import { NextResponse } from "next/server";
import { requireTripOwner } from "@/lib/auth/resolve-caller";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { broadcastTripChange } from "@/lib/realtime/broadcast";

// votes.decision_id cascades, so deleting the decision cleans up its votes
// for free. Admin-only: this throws away a real, possibly-locked group
// decision, not a personal item like an idea or booking.
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ tripId: string; decisionId: string }> }
) {
  const { tripId, decisionId } = await params;
  const supabase = createServiceSupabaseClient();
  const owner = await requireTripOwner(tripId, supabase);
  if ("error" in owner) return owner.error;

  const { error } = await supabase.from("decisions").delete().eq("id", decisionId).eq("trip_id", tripId);
  if (error) return NextResponse.json({ error: "delete_failed" }, { status: 500 });

  await broadcastTripChange(tripId);
  return NextResponse.json({ ok: true });
}
