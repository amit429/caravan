import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/session";
import type { createServiceSupabaseClient } from "@/lib/supabase/service";

export type CallerLookup = { id: string; status: "active" | "removed"; role: "member" | "admin" } | null;

// Everyone — admin or member — authenticates through Supabase Auth now, so
// resolving a caller is one lookup: their members row for this trip, by
// email. A trip's admin is mirrored into members with role='admin' at
// creation time (see app/api/trips/route.ts), so this single path naturally
// covers both; there's no separate identity system to branch on anymore.
export async function resolveCaller(
  tripId: string,
  supabase: ReturnType<typeof createServiceSupabaseClient>
): Promise<CallerLookup> {
  const authUser = await getAuthUser();
  if (!authUser) return null;
  const { data } = await supabase
    .from("members")
    .select("id, status, role")
    .eq("trip_id", tripId)
    .eq("email", authUser.email)
    .maybeSingle();
  return data ?? null;
}

// 401 = no session at all (never joined / never signed in). 403 = a real member/admin
// row exists but was removed by the admin — this is how a removed member's client
// learns to clear its cookie (spec §8).
export function callerAuthError(caller: CallerLookup) {
  if (!caller) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (caller.status === "removed") return NextResponse.json({ error: "removed" }, { status: 403 });
  return null;
}

export type TripOwnerResult = { admin: { id: string; email: string; name: string } } | { error: ReturnType<typeof NextResponse.json> };

// Admin-only routes that go through the service-role client (which bypasses RLS
// entirely) must check ownership themselves — RLS-backed routes get this for free
// from the "admin manages own trip X" policies, but service-role ones don't.
// Being *an* admin only proves you own *some* trip, not this one.
export async function requireTripOwner(
  tripId: string,
  supabase: ReturnType<typeof createServiceSupabaseClient>
): Promise<TripOwnerResult> {
  const admin = await getAuthUser();
  if (!admin) return { error: NextResponse.json({ error: "unauthenticated" }, { status: 401 }) };
  const { data: trip } = await supabase.from("trips").select("admin_user_id").eq("id", tripId).maybeSingle();
  if (!trip) return { error: NextResponse.json({ error: "not_found" }, { status: 404 }) };
  if (trip.admin_user_id !== admin.id) return { error: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
  return { admin };
}
