import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ tripId: string }> }
) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  const { tripId } = await params;
  const { action } = await request.json();

  const supabase = await createServerSupabaseClient();
  const { data: trip, error: fetchError } = await supabase
    .from("trips")
    .select()
    .eq("id", tripId)
    .single();
  if (fetchError || !trip) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (trip.admin_user_id !== admin.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  if (action === "start") {
    if (trip.status !== "lobby") {
      return NextResponse.json({ error: "trip_not_in_lobby" }, { status: 409 });
    }
    const { data, error } = await supabase
      .from("trips")
      .update({ status: "active" })
      .eq("id", tripId)
      .select()
      .single();
    if (error) return NextResponse.json({ error: "update_failed" }, { status: 500 });
    return NextResponse.json({ trip: data });
  }

  if (action === "toggle_joining") {
    const { data, error } = await supabase
      .from("trips")
      .update({ joining_open: !trip.joining_open })
      .eq("id", tripId)
      .select()
      .single();
    if (error) return NextResponse.json({ error: "update_failed" }, { status: 500 });
    return NextResponse.json({ trip: data });
  }

  return NextResponse.json({ error: "unknown_action" }, { status: 400 });
}
