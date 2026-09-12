import { NextResponse, after } from "next/server";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { resolveCaller, callerAuthError } from "@/lib/auth/resolve-caller";
import { runScribe } from "@/lib/agents/scribe";
import { broadcastTripChange } from "@/lib/realtime/broadcast";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ tripId: string }> }
) {
  const { tripId } = await params;
  const supabase = createServiceSupabaseClient();
  const caller = await resolveCaller(tripId, supabase);
  const authError = callerAuthError(caller);
  if (authError) return authError;
  const { data, error } = await supabase
    .from("messages")
    .select()
    .eq("trip_id", tripId)
    .order("created_at", { ascending: true });
  if (error) return NextResponse.json({ error: "could_not_list_messages" }, { status: 500 });
  return NextResponse.json({ messages: data });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tripId: string }> }
) {
  const { tripId } = await params;
  const supabase = createServiceSupabaseClient();
  const caller = await resolveCaller(tripId, supabase);
  const authError = callerAuthError(caller);
  if (authError) return authError;
  const callerMemberId = caller!.id;

  const { data: trip } = await supabase.from("trips").select("id, status").eq("id", tripId).single();
  if (!trip) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (trip.status !== "active") {
    return NextResponse.json({ error: "trip_not_active" }, { status: 409 });
  }

  const { body } = await request.json();
  if (typeof body !== "string" || body.trim().length === 0 || body.length > 2000) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const { data: message, error } = await supabase
    .from("messages")
    .insert({
      trip_id: tripId,
      lane: "group",
      author_type: "member",
      author_id: callerMemberId,
      body: body.trim(),
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: "could_not_post_message" }, { status: 500 });

  // Broadcast (not postgres_changes) so members receive it live too — see
  // lib/realtime/broadcast for why postgres_changes can't reach them.
  await broadcastTripChange(tripId, { type: "message", message });

  // Extraction runs after the response is sent — the member's message posts
  // instantly, Scribe's gate+extract calls never block it (spec §8.1 message
  // trigger, simplified to per-message since real debouncing needs a queue).
  after(async () => {
    const { data: authorMember } = await supabase.from("members").select().eq("id", callerMemberId).single();
    if (authorMember) {
      await runScribe({ tripId, message, authorMember });
    }
  });

  return NextResponse.json({ message }, { status: 201 });
}
