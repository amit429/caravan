import { NextResponse } from "next/server";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { resolveCaller, callerAuthError } from "@/lib/auth/resolve-caller";
import { getAdminUser } from "@/lib/auth/session";
import { broadcastTripChange } from "@/lib/realtime/broadcast";

// Whoever pasted the link can pull it back; the trip's own admin can too
// (moderation, same as removing a member) — nobody else's delete reaches
// another member's idea.
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ tripId: string; ideaId: string }> }
) {
  const { tripId, ideaId } = await params;
  const supabase = createServiceSupabaseClient();
  const caller = await resolveCaller(tripId, supabase);
  const authError = callerAuthError(caller);
  if (authError) return authError;

  const { data: idea } = await supabase.from("ideas").select("id, member_id").eq("id", ideaId).eq("trip_id", tripId).maybeSingle();
  if (!idea) return NextResponse.json({ error: "not_found" }, { status: 404 });

  if (idea.member_id !== caller!.id) {
    const admin = await getAdminUser();
    if (!admin) return NextResponse.json({ error: "not_your_idea" }, { status: 403 });
    const { data: trip } = await supabase.from("trips").select("admin_user_id").eq("id", tripId).single();
    if (!trip || trip.admin_user_id !== admin.id) {
      return NextResponse.json({ error: "not_your_idea" }, { status: 403 });
    }
  }

  const { error } = await supabase.from("ideas").delete().eq("id", ideaId);
  if (error) return NextResponse.json({ error: "could_not_delete_idea" }, { status: 500 });
  await broadcastTripChange(tripId);
  return NextResponse.json({ ok: true });
}
