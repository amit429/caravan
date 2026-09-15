import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { broadcastTripChange } from "@/lib/realtime/broadcast";
import type { AuthUser } from "@/lib/auth/session";
import type { MemberRow } from "@/lib/database.types";

export type JoinResult =
  | { ok: true; member: MemberRow }
  | { ok: false; reason: "not_found" | "joining_closed" | "removed" };

// Everyone joins as themselves now (Google OAuth, spec addendum) — there's
// no name/email form to submit anymore. Resuming an existing membership
// (rejoining from a new device, or just re-opening the link) is silent: same
// email, same member row, no duplicate.
export async function joinTripAsMember(code: string, authUser: AuthUser): Promise<JoinResult> {
  const supabase = createServiceSupabaseClient();
  const { data: trip } = await supabase.from("trips").select("id, joining_open, status").eq("invite_code", code).maybeSingle();
  if (!trip) return { ok: false, reason: "not_found" };

  const { data: existing } = await supabase
    .from("members")
    .select()
    .eq("trip_id", trip.id)
    .eq("email", authUser.email)
    .maybeSingle();

  if (existing) {
    if (existing.status === "removed") return { ok: false, reason: "removed" };
    return { ok: true, member: existing as MemberRow };
  }

  if (!trip.joining_open || trip.status === "closed") {
    return { ok: false, reason: "joining_closed" };
  }

  const { data: created, error } = await supabase
    .from("members")
    .insert({ trip_id: trip.id, display_name: authUser.name, email: authUser.email })
    .select()
    .single();
  if (error || !created) return { ok: false, reason: "not_found" };

  await broadcastTripChange(trip.id);
  return { ok: true, member: created as MemberRow };
}
