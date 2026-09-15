import { NextResponse } from "next/server";
import { getAdminUser, getMemberSession } from "@/lib/auth/session";
import type { createServiceSupabaseClient } from "@/lib/supabase/service";

export type CallerLookup = { id: string; status: "active" | "removed" } | null;

// Resolves whoever is calling — admin (Supabase Auth) or member (JWT cookie) —
// down to their `members` row for this trip. Used by every route that both
// admins and members can hit (messages, intake, votes): once resolved, the
// caller's member_id is all that matters, not which identity system got them there.
export async function resolveCaller(
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
export function callerAuthError(caller: CallerLookup) {
  if (!caller) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (caller.status === "removed") return NextResponse.json({ error: "removed" }, { status: 403 });
  return null;
}

export type TripOwnerResult = { admin: { id: string; email: string } } | { error: ReturnType<typeof NextResponse.json> };

// Admin-only routes that go through the service-role client (which bypasses RLS
// entirely) must check ownership themselves — RLS-backed routes get this for free
// from the "admin manages own trip X" policies, but service-role ones don't.
// Being *an* admin only proves you own *some* trip, not this one.
export async function requireTripOwner(
  tripId: string,
  supabase: ReturnType<typeof createServiceSupabaseClient>
): Promise<TripOwnerResult> {
  const admin = await getAdminUser();
  if (!admin) return { error: NextResponse.json({ error: "unauthenticated" }, { status: 401 }) };
  const { data: trip } = await supabase.from("trips").select("admin_user_id").eq("id", tripId).maybeSingle();
  if (!trip) return { error: NextResponse.json({ error: "not_found" }, { status: 404 }) };
  if (trip.admin_user_id !== admin.id) return { error: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
  return { admin };
}
