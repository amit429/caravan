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
}) {
  const supabase = createServiceSupabaseClient();
  const { data: message } = await supabase
    .from("messages")
    .insert({
      trip_id: params.tripId,
      lane: "group",
      author_type: "agent",
      author_id: null,
      agent_name: params.agentName,
      body: params.body,
      metadata: params.metadata ?? {},
    })
    .select()
    .single();
  if (message) {
    await broadcastTripChange(params.tripId, { type: "message", message });
  }
}
