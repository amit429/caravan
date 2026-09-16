import { NextResponse } from "next/server";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { resolveCaller, callerAuthError } from "@/lib/auth/resolve-caller";
import { broadcastTripChange } from "@/lib/realtime/broadcast";

// Same toggleable-upvote shape as idea votes — one tap adds it, a second
// tap removes it. This is the "top voted" signal the admin uses to decide
// which accommodations to lock.
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ tripId: string; accommodationId: string }> }
) {
  const { tripId, accommodationId } = await params;
  const supabase = createServiceSupabaseClient();
  const caller = await resolveCaller(tripId, supabase);
  const authError = callerAuthError(caller);
  if (authError) return authError;

  const { data: existing } = await supabase
    .from("accommodation_votes")
    .select("id")
    .eq("accommodation_id", accommodationId)
    .eq("member_id", caller!.id)
    .maybeSingle();

  if (existing) {
    await supabase.from("accommodation_votes").delete().eq("id", existing.id);
    await broadcastTripChange(tripId);
    return NextResponse.json({ voted: false });
  }

  await supabase.from("accommodation_votes").insert({ accommodation_id: accommodationId, member_id: caller!.id });
  await broadcastTripChange(tripId);
  return NextResponse.json({ voted: true });
}
