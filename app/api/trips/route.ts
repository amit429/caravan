import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/auth/session";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { generateInviteCode } from "@/lib/invite-code";
import { createTripSchema } from "@/lib/validation";

export async function POST(request: Request) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = createTripSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = createServiceSupabaseClient();

  let trip = null;
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 5 && !trip; attempt++) {
    const { data, error } = await supabase
      .from("trips")
      .insert({
        name: parsed.data.name,
        rough_intent: parsed.data.roughIntent ?? null,
        admin_user_id: admin.id,
        invite_code: generateInviteCode(),
        vibe: parsed.data.vibe,
        budget_hint: parsed.data.budgetHint ?? null,
        agent_tone: parsed.data.agentTone,
      })
      .select()
      .single();
    if (error) {
      lastError = error;
      continue; // likely a unique-constraint collision on invite_code; retry with a new code
    }
    trip = data;
  }

  if (!trip) {
    console.error("failed to create trip after retries", lastError);
    return NextResponse.json({ error: "could_not_create_trip" }, { status: 500 });
  }

  const { error: memberError } = await supabase.from("members").insert({
    trip_id: trip.id,
    display_name: admin.email.split("@")[0],
    email: admin.email,
    role: "admin",
    status: "active",
  });
  if (memberError) {
    console.error("failed to mirror admin as member", memberError);
  }

  return NextResponse.json({ trip }, { status: 201 });
}
