import { NextResponse } from "next/server";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { resolveCaller, callerAuthError, requireTripOwner } from "@/lib/auth/resolve-caller";
import { createBookingSchema } from "@/lib/validation";
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
    .from("bookings")
    .select()
    .eq("trip_id", tripId)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: "could_not_list_bookings" }, { status: 500 });
  return NextResponse.json({ bookings: data });
}

// Admin-only, like decision creation — bookings are things the admin is
// tracking on the group's behalf, not something any member files.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ tripId: string }> }
) {
  const { tripId } = await params;
  const supabase = createServiceSupabaseClient();
  const owner = await requireTripOwner(tripId, supabase);
  if ("error" in owner) return owner.error;

  const body = await request.json();
  const parsed = createBookingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { data: booking, error } = await supabase
    .from("bookings")
    .insert({ trip_id: tripId, item: parsed.data.item, deadline: parsed.data.deadline ?? null })
    .select()
    .single();
  if (error) return NextResponse.json({ error: "could_not_create_booking" }, { status: 500 });
  await broadcastTripChange(tripId);
  return NextResponse.json({ booking }, { status: 201 });
}
