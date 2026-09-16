import { NextResponse } from "next/server";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { resolveCaller, callerAuthError } from "@/lib/auth/resolve-caller";
import { broadcastTripChange } from "@/lib/realtime/broadcast";

// Same toggleable-upvote shape as accommodation/idea votes.
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ tripId: string; travelOptionId: string }> }
) {
  const { tripId, travelOptionId } = await params;
  const supabase = createServiceSupabaseClient();
  const caller = await resolveCaller(tripId, supabase);
  const authError = callerAuthError(caller);
  if (authError) return authError;

  const { data: existing } = await supabase
    .from("travel_option_votes")
    .select("id")
    .eq("travel_option_id", travelOptionId)
    .eq("member_id", caller!.id)
    .maybeSingle();

  if (existing) {
    await supabase.from("travel_option_votes").delete().eq("id", existing.id);
    await broadcastTripChange(tripId);
    return NextResponse.json({ voted: false });
  }

  await supabase.from("travel_option_votes").insert({ travel_option_id: travelOptionId, member_id: caller!.id });
  await broadcastTripChange(tripId);
  return NextResponse.json({ voted: true });
}
