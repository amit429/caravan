import { NextResponse } from "next/server";
import { getAdminUser, getMemberSession } from "@/lib/auth/session";
import { createServiceSupabaseClient } from "@/lib/supabase/service";

type CallerLookup = { id: string; status: "active" | "removed" } | null;

async function resolveCaller(
  tripId: string,
  supabase: ReturnType<typeof createServiceSupabaseClient>
): Promise<CallerLookup> {
  const admin = await getAdminUser();
  if (admin) {
    const { data } = await supabase
      .from("members")
      .select("id, status")
      .eq("trip_id", tripId)
      .eq("email", admin.email)
      .maybeSingle();
    return data ?? null;
  }
  const memberSession = await getMemberSession();
  if (memberSession && memberSession.tripId === tripId) {
    const { data } = await supabase
      .from("members")
      .select("id, status")
      .eq("trip_id", tripId)
      .eq("id", memberSession.memberId)
      .maybeSingle();
    return data ?? null;
  }
  return null;
}

// 401 = no session at all (never joined / never signed in). 403 = a real member/admin
// row exists but was removed by the admin — this is how a removed member's client
// learns to clear its cookie (spec §8).
function callerAuthError(caller: CallerLookup) {
  if (!caller) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (caller.status === "removed") return NextResponse.json({ error: "removed" }, { status: 403 });
  return null;
}

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
