import { createServiceSupabaseClient } from "@/lib/supabase/service";

// Everyone authenticates through Supabase Auth now, but the RLS policies on
// messages/decisions/etc. only ever grant SELECT to a trip's admin_user_id —
// there's no "member reads own trip X" policy, on purpose (see resolve-caller.ts:
// dual-audience routes are authorized at the app level via resolveCaller, not
// through RLS). So postgres_changes realtime still silently drops every event
// for a plain member's session. Broadcast sidesteps RLS entirely — the server
// sends after a mutation it has already app-level-authorized, and any client,
// admin or member, can listen on the trip's channel with no RLS dependency.
export async function broadcastTripChange(tripId: string, payload: Record<string, unknown> = {}) {
  const supabase = createServiceSupabaseClient();
  const channel = supabase.channel(`trip:${tripId}`);
  try {
    await channel.send({ type: "broadcast", event: "change", payload });
  } finally {
    await supabase.removeChannel(channel);
  }
}
