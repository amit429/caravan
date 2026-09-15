import { NextResponse } from "next/server";
import { createServiceSupabaseClient } from "@/lib/supabase/service";

// The join action itself is now a server-rendered redirect (see
// /join/[code]/complete), not a client POST — everyone joins through Google
// OAuth, so there's no form body left to submit. This GET is just the
// public "peek at the trip before you commit to joining" the invite landing
// page uses.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const supabase = createServiceSupabaseClient();
  const { data: trip, error } = await supabase
    .from("trips")
    .select("id, name, rough_intent, joining_open, status")
    .eq("invite_code", code)
    .single();
  if (error || !trip) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const { count } = await supabase
    .from("members")
    .select("*", { count: "exact", head: true })
    .eq("trip_id", trip.id);
  return NextResponse.json({
    trip: { name: trip.name, roughIntent: trip.rough_intent, memberCount: count ?? 0 },
    joinable: trip.joining_open && trip.status !== "closed",
  });
}
