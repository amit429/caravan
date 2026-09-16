import { NextResponse } from "next/server";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { resolveCaller, callerAuthError } from "@/lib/auth/resolve-caller";
import { extractTravelOptionDetails } from "@/lib/travel/extract-travel-option";
import { createTravelOptionSchema } from "@/lib/validation";
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
    .from("travel_options")
    .select()
    .eq("trip_id", tripId)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: "could_not_list_travel_options" }, { status: 500 });
  return NextResponse.json({ travelOptions: data });
}

// A manually-given mode always wins over whatever the model would classify
// it as — the person typing it in knows for certain whether it's a flight
// or a bus, same "manual input wins" rule as accommodation price.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ tripId: string }> }
) {
  const { tripId } = await params;
  const supabase = createServiceSupabaseClient();
  const caller = await resolveCaller(tripId, supabase);
  const authError = callerAuthError(caller);
  if (authError) return authError;

  const body = await request.json();
  const parsed = createTravelOptionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const details = await extractTravelOptionDetails({ name: parsed.data.name, url: parsed.data.url });

  const { data: travelOption, error } = await supabase
    .from("travel_options")
    .insert({
      trip_id: tripId,
      member_id: caller!.id,
      name: details.title,
      mode: parsed.data.mode,
      timing: parsed.data.timing ?? details.timing,
      price: parsed.data.price ?? details.price,
      url: parsed.data.url ?? null,
      source: "manual",
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: "could_not_save_travel_option" }, { status: 500 });
  await broadcastTripChange(tripId);
  return NextResponse.json({ travelOption }, { status: 201 });
}
