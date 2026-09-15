import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { resolveCaller, callerAuthError, requireTripOwner } from "@/lib/auth/resolve-caller";
import { broadcastTripChange } from "@/lib/realtime/broadcast";
import { postAgentMessage } from "@/lib/agents/runtime/post-agent-message";
import { buildKickoffMessage } from "@/lib/trips/kickoff-message";
import { MIN_MEMBERS_TO_OPEN } from "@/lib/trips/constants";

// Dual-auth: the member lobby needs this before the trip goes active, when the
// only realtime channel members can hear is the broadcast one (see
// lib/realtime/broadcast) — this is the fetch RealtimeRefresh-style clients
// re-run on each broadcast, same as Plan/Room do via their server components.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ tripId: string }> }
) {
  const { tripId } = await params;
  const supabase = createServiceSupabaseClient();
  const caller = await resolveCaller(tripId, supabase);
  const authError = callerAuthError(caller);
  if (authError) return authError;

  const { data: trip } = await supabase
    .from("trips")
    .select("id, name, status")
    .eq("id", tripId)
    .single();
  if (!trip) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const { data: members } = await supabase
    .from("members")
    .select()
    .eq("trip_id", tripId)
    .eq("status", "active")
    .order("created_at", { ascending: true });

  return NextResponse.json({ trip, members: members ?? [] });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ tripId: string }> }
) {
  const admin = await getAuthUser();
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
    // Only gates the lobby → active transition, so a trip that was already
    // active before this rule shipped is never retroactively affected.
    const { count: memberCount } = await supabase
      .from("members")
      .select("id", { count: "exact", head: true })
      .eq("trip_id", tripId)
      .eq("status", "active");
    if ((memberCount ?? 0) < MIN_MEMBERS_TO_OPEN) {
      return NextResponse.json(
        { error: "not_enough_members", minMembers: MIN_MEMBERS_TO_OPEN },
        { status: 409 }
      );
    }
    const { data, error } = await supabase
      .from("trips")
      .update({ status: "active" })
      .eq("id", tripId)
      .select()
      .single();
    if (error) return NextResponse.json({ error: "update_failed" }, { status: 500 });
    await postAgentMessage({
      tripId,
      agentName: "concierge",
      body: buildKickoffMessage({ rough_intent: trip.rough_intent, vibe: trip.vibe, budget_hint: trip.budget_hint }),
    });
    await broadcastTripChange(tripId);
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
    await broadcastTripChange(tripId);
    return NextResponse.json({ trip: data });
  }

  return NextResponse.json({ error: "unknown_action" }, { status: 400 });
}

// Every child table (members, messages, facts, decisions, ideas, bookings,
// cost_estimates, threads, agent_runs, ...) has `on delete cascade` back to
// trips.id, so a hard delete here is a genuine one-shot teardown — no
// orphaned rows anywhere. There's no soft-delete/undo for this on purpose:
// it's the one truly destructive admin action in the app, guarded by a
// destructive confirm sheet client-side.
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ tripId: string }> }
) {
  const { tripId } = await params;
  const supabase = createServiceSupabaseClient();
  const owner = await requireTripOwner(tripId, supabase);
  if ("error" in owner) return owner.error;

  const { error } = await supabase.from("trips").delete().eq("id", tripId);
  if (error) return NextResponse.json({ error: "delete_failed" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
