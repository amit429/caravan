import type { createServiceSupabaseClient } from "@/lib/supabase/service";
import type { MessageRow } from "@/lib/database.types";
import { ensureThread } from "./ensure-thread";
import { postAgentMessage } from "@/lib/agents/runtime/post-agent-message";

// Shared by the thread API route and the You page's server component so
// both land on the exact same "ensure it exists, seed it if it's brand new"
// behavior instead of two copies drifting apart.
const SEED_BODY =
  "I've got five quick questions for you — dates, budget, departure city, vibe, and anything that's a hard no. Tap through below, or just tell me in your own words and I'll work it out.";

export async function loadThread(
  tripId: string,
  memberId: string,
  supabase: ReturnType<typeof createServiceSupabaseClient>
): Promise<{ threadId: string; messages: MessageRow[] }> {
  const threadId = await ensureThread(tripId, memberId, supabase);
  const { data: messages } = await supabase
    .from("messages")
    .select()
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true });

  if (!messages || messages.length === 0) {
    await postAgentMessage({ tripId, agentName: "concierge", body: SEED_BODY, threadId });
    const { data: seeded } = await supabase
      .from("messages")
      .select()
      .eq("thread_id", threadId)
      .order("created_at", { ascending: true });
    return { threadId, messages: (seeded ?? []) as MessageRow[] };
  }

  return { threadId, messages: messages as MessageRow[] };
}
