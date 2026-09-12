import { NextResponse } from "next/server";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { resolveCaller, callerAuthError } from "@/lib/auth/resolve-caller";

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
  return NextResponse.json({ message }, { status: 201 });
}
