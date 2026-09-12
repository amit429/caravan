import { NextResponse } from "next/server";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { resolveCaller, callerAuthError } from "@/lib/auth/resolve-caller";
import { broadcastTripChange } from "@/lib/realtime/broadcast";

// Idea votes are a simple toggleable upvote (not the veto/lock machinery
// decisions use) — one tap adds it, a second tap removes it.
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ tripId: string; ideaId: string }> }
) {
  const { tripId, ideaId } = await params;
  const supabase = createServiceSupabaseClient();
  const caller = await resolveCaller(tripId, supabase);
  const authError = callerAuthError(caller);
  if (authError) return authError;

  const { data: existing } = await supabase
    .from("idea_votes")
    .select("id")
    .eq("idea_id", ideaId)
    .eq("member_id", caller!.id)
    .maybeSingle();

  if (existing) {
    await supabase.from("idea_votes").delete().eq("id", existing.id);
    await broadcastTripChange(tripId);
    return NextResponse.json({ voted: false });
  }

  await supabase.from("idea_votes").insert({ idea_id: ideaId, member_id: caller!.id });
  await broadcastTripChange(tripId);
  return NextResponse.json({ voted: true });
}
