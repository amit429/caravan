import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { resolveCaller, callerAuthError } from "@/lib/auth/resolve-caller";
import { createDecisionSchema } from "@/lib/validation";
import { broadcastTripChange } from "@/lib/realtime/broadcast";
import { postAgentMessage } from "@/lib/agents/runtime/post-agent-message";
import { buildDecisionOpenedMessage } from "@/lib/decisions/opened-message";

// Listing is dual-auth (admin or member both view decisions on Plan/Room) so it
// goes through the service client like messages/intake. Creating a decision is
// admin-only, so it goes through the RLS-backed session client instead.

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
    .from("decisions")
    .select()
    .eq("trip_id", tripId)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: "could_not_list_decisions" }, { status: 500 });
  return NextResponse.json({ decisions: data });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tripId: string }> }
) {
  const admin = await getAuthUser();
  if (!admin) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const { tripId } = await params;
  const body = await request.json();
  const parsed = createDecisionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();
  const { data: trip } = await supabase.from("trips").select("id").eq("id", tripId).single();
  if (!trip) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const { data: decision, error } = await supabase
    .from("decisions")
    .insert({
      trip_id: tripId,
      type: parsed.data.type,
      state: "OPEN",
      options: parsed.data.options,
      quorum_rule: parsed.data.quorumRule,
      deadline: parsed.data.deadline ?? null,
      default_on_silence: parsed.data.defaultOnSilence,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: "could_not_create_decision" }, { status: 500 });
  await postAgentMessage({
    tripId,
    agentName: "concierge",
    body: buildDecisionOpenedMessage(decision),
  });
  await broadcastTripChange(tripId);
  return NextResponse.json({ decision }, { status: 201 });
}
