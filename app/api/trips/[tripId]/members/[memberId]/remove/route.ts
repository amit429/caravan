import { NextResponse } from "next/server";
import { requireTripOwner } from "@/lib/auth/resolve-caller";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { removeMemberAndRerun } from "@/lib/trips/remove-member";
import { broadcastTripChange } from "@/lib/realtime/broadcast";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ tripId: string; memberId: string }> }
) {
  const { tripId, memberId } = await params;
  const supabase = createServiceSupabaseClient();
  const owner = await requireTripOwner(tripId, supabase);
  if ("error" in owner) return owner.error;

  const result = await removeMemberAndRerun(tripId, memberId);
  await broadcastTripChange(tripId);
  return NextResponse.json(result);
}
