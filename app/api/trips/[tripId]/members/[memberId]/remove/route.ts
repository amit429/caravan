import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { broadcastTripChange } from "@/lib/realtime/broadcast";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ tripId: string; memberId: string }> }
) {
  const admin = await getAuthUser();
  if (!admin) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const { tripId, memberId } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: trip } = await supabase.from("trips").select("admin_user_id").eq("id", tripId).single();
  if (!trip) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (trip.admin_user_id !== admin.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { error } = await supabase.from("members").update({ status: "removed" }).eq("id", memberId);
  if (error) return NextResponse.json({ error: "update_failed" }, { status: 500 });
  await broadcastTripChange(tripId);
  return NextResponse.json({ ok: true });
}
