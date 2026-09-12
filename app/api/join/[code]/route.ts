import { NextResponse } from "next/server";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { joinTripSchema } from "@/lib/validation";
import { signMemberToken } from "@/lib/auth/member-jwt";
import { MEMBER_TOKEN_COOKIE } from "@/lib/auth/session";
import { broadcastTripChange } from "@/lib/realtime/broadcast";

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

export async function POST(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const body = await request.json();
  const parsed = joinTripSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = createServiceSupabaseClient();
  const { data: trip, error: tripError } = await supabase
    .from("trips")
    .select("id, joining_open")
    .eq("invite_code", code)
    .single();
  if (tripError || !trip) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (!trip.joining_open) {
    return NextResponse.json({ error: "joining_closed" }, { status: 409 });
  }

  const { data: existingMember } = await supabase
    .from("members")
    .select()
    .eq("trip_id", trip.id)
    .eq("email", parsed.data.email)
    .maybeSingle();

  const member =
    existingMember ??
    (
      await supabase
        .from("members")
        .insert({
          trip_id: trip.id,
          display_name: parsed.data.displayName,
          email: parsed.data.email,
        })
        .select()
        .single()
    ).data;

  if (!member) {
    return NextResponse.json({ error: "could_not_join" }, { status: 500 });
  }

  if (!existingMember) {
    await broadcastTripChange(trip.id);
  }

  const token = await signMemberToken({ tripId: trip.id, memberId: member.id });
  const response = NextResponse.json({ member });
  response.cookies.set(MEMBER_TOKEN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 180,
  });
  return response;
}
