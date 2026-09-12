import { createServiceSupabaseClient } from "@/lib/supabase/service";

// Members authenticate via a custom JWT, not Supabase Auth (spec §10) — their
// browser has no auth.uid(), so Postgres-changes realtime (which is gated by
// each table's RLS policies) silently drops every event for them: verified
// that `messages` only has an admin-scoped SELECT policy. Broadcast sidesteps
// RLS entirely — the server sends after a mutation it has already
// app-level-authorized (resolveCaller/getAdminUser), and any client, admin or
// member, can listen on the trip's channel with no auth.uid() dependency.
export async function broadcastTripChange(tripId: string, payload: Record<string, unknown> = {}) {
  const supabase = createServiceSupabaseClient();
  const channel = supabase.channel(`trip:${tripId}`);
  try {
    await channel.send({ type: "broadcast", event: "change", payload });
  } finally {
    await supabase.removeChannel(channel);
  }
}
