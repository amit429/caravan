import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { broadcastTripChange } from "@/lib/realtime/broadcast";
import type { AgentName } from "@/lib/database.types";

// Agent messages are visually distinct from member messages and never posted
// twice in a row without a member message or state change between (spec §8.2)
// — callers are responsible for that rule; this just does the insert and
// broadcasts it so it shows up live for both admin and member listeners
// (postgres_changes realtime can't reach members — see lib/realtime/broadcast).
export async function postAgentMessage(params: {
  tripId: string;
  agentName: AgentName;
  body: string;
  metadata?: Record<string, unknown>;
  threadId?: string;
}) {
  const supabase = createServiceSupabaseClient();
  const { data: message } = await supabase
    .from("messages")
    .insert({
      trip_id: params.tripId,
      lane: params.threadId ? "thread" : "group",
      thread_id: params.threadId ?? null,
      author_type: "agent",
      author_id: null,
      agent_name: params.agentName,
      body: params.body,
      metadata: params.metadata ?? {},
    })
    .select()
    .single();
  if (message) {
    // Thread messages get their own broadcast shape (type: "thread_message")
    // so the group Room feed — which only appends on type "message" — never
    // picks up a member's private thread content (spec D8).
    await broadcastTripChange(
      params.tripId,
      params.threadId ? { type: "thread_message", threadId: params.threadId, message } : { type: "message", message }
    );
  }
}
