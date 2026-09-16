import { NextResponse } from "next/server";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { resolveCaller, callerAuthError } from "@/lib/auth/resolve-caller";
import { broadcastTripChange } from "@/lib/realtime/broadcast";

// "I'm on this one" — unlike accommodations (everyone's assumed together),
// travel genuinely splits: some fly, some drive. A member can join more
// than one option (e.g. flight there, train back), so this is a toggle,
// not a single-pick — same idempotent add/remove shape as voting.
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
    .from("travel_option_members")
    .select("id")
    .eq("travel_option_id", travelOptionId)
    .eq("member_id", caller!.id)
    .maybeSingle();

  if (existing) {
    await supabase.from("travel_option_members").delete().eq("id", existing.id);
    await broadcastTripChange(tripId);
    return NextResponse.json({ joined: false });
  }

  await supabase.from("travel_option_members").insert({ travel_option_id: travelOptionId, member_id: caller!.id });
  await broadcastTripChange(tripId);
  return NextResponse.json({ joined: true });
}
