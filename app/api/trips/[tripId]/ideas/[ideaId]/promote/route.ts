import { NextResponse } from "next/server";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { requireTripOwner } from "@/lib/auth/resolve-caller";
import { broadcastTripChange } from "@/lib/realtime/broadcast";

// Turns a suggested stay/travel idea (chat-detected or pasted) into a real
// tracked booking, one tap — admin-only, same as creating a booking from
// scratch already is (bookings are things the admin is tracking on the
// group's behalf, not something any member files).
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ tripId: string; ideaId: string }> }
) {
  const { tripId, ideaId } = await params;
  const supabase = createServiceSupabaseClient();
  const owner = await requireTripOwner(tripId, supabase);
  if ("error" in owner) return owner.error;

  const { data: idea } = await supabase
    .from("ideas")
    .select("id, title, url, category")
    .eq("id", ideaId)
    .eq("trip_id", tripId)
    .maybeSingle();
  if (!idea) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (idea.category !== "stay" && idea.category !== "travel") {
    return NextResponse.json({ error: "not_a_suggestion" }, { status: 400 });
  }

  const { data: booking, error } = await supabase
    .from("bookings")
    .insert({ trip_id: tripId, item: idea.title ?? idea.url ?? "Untitled" })
    .select()
    .single();
  if (error) return NextResponse.json({ error: "could_not_create_booking" }, { status: 500 });

  await broadcastTripChange(tripId);
  return NextResponse.json({ booking }, { status: 201 });
}
