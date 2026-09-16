import { NextResponse } from "next/server";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { resolveCaller, callerAuthError } from "@/lib/auth/resolve-caller";
import { extractAccommodationDetails } from "@/lib/accommodations/extract-accommodation";
import { createAccommodationSchema } from "@/lib/validation";
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
    .from("accommodations")
    .select()
    .eq("trip_id", tripId)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: "could_not_list_accommodations" }, { status: 500 });
  return NextResponse.json({ accommodations: data });
}

// Same AI enrichment path as a chat-detected stay (spec: consistent
// behavior whether it came from Scribe or someone typing it in directly) —
// a manually-given price always wins over whatever Tavily finds, since
// that's the one field the person typing it in actually knows firsthand.
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
  const parsed = createAccommodationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const details = await extractAccommodationDetails({ name: parsed.data.name, url: parsed.data.url });

  const { data: accommodation, error } = await supabase
    .from("accommodations")
    .insert({
      trip_id: tripId,
      member_id: caller!.id,
      name: details.title,
      url: parsed.data.url ?? null,
      price: parsed.data.price ?? details.price,
      area: details.area,
      image_url: details.imageUrl,
      source: "manual",
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: "could_not_save_accommodation" }, { status: 500 });
  await broadcastTripChange(tripId);
  return NextResponse.json({ accommodation }, { status: 201 });
}
