import type { createServiceSupabaseClient } from "@/lib/supabase/service";

// One thread per (trip, member), created lazily on first visit rather than
// at member-join time — most trips never need to be looked at twice before
// intake, and this keeps join from doing extra writes it might not need.
export async function ensureThread(
  tripId: string,
  memberId: string,
  supabase: ReturnType<typeof createServiceSupabaseClient>
): Promise<string> {
  const { data: existing } = await supabase
    .from("threads")
    .select("id")
    .eq("trip_id", tripId)
    .eq("member_id", memberId)
    .maybeSingle();
  if (existing) return existing.id;

  const { data: created } = await supabase
    .from("threads")
    .insert({ trip_id: tripId, member_id: memberId })
    .select("id")
    .single();
  if (created) return created.id;

  // Lost a race with a concurrent insert (unique(trip_id, member_id)) — it
  // exists now, just not under this call.
  const { data: retry } = await supabase
    .from("threads")
    .select("id")
    .eq("trip_id", tripId)
    .eq("member_id", memberId)
    .single();
  return retry!.id;
}
