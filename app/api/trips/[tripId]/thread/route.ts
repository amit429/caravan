import { NextResponse, after } from "next/server";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { resolveCaller, callerAuthError } from "@/lib/auth/resolve-caller";
import { ensureThread } from "@/lib/threads/ensure-thread";
import { loadThread } from "@/lib/threads/load-thread";
import { runScribe } from "@/lib/agents/scribe";
import { broadcastTripChange } from "@/lib/realtime/broadcast";
import { threadMessageSchema } from "@/lib/validation";

// PRD §18 D8: "the agent's 1:1 intake is simply a thread with one member."
// There's no memberId param anywhere here on purpose — resolveCaller always
// resolves to the caller's own member_id, so this route can only ever reach
// the caller's own thread. That's what keeps a thread visible only to its
// one participant; there's no code path for reading someone else's.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ tripId: string }> }
) {
  const { tripId } = await params;
  const supabase = createServiceSupabaseClient();
  const caller = await resolveCaller(tripId, supabase);
  const authError = callerAuthError(caller);
  if (authError) return authError;

  const { threadId, messages } = await loadThread(tripId, caller!.id, supabase);
  return NextResponse.json({ threadId, messages });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tripId: string }> }
) {
  const { tripId } = await params;
  const supabase = createServiceSupabaseClient();
  const caller = await resolveCaller(tripId, supabase);
  const authError = callerAuthError(caller);
  if (authError) return authError;
  const callerMemberId = caller!.id;

  const body = await request.json();
  const parsed = threadMessageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const threadId = await ensureThread(tripId, callerMemberId, supabase);
  const { data: message, error } = await supabase
    .from("messages")
    .insert({
      trip_id: tripId,
      lane: "thread",
      thread_id: threadId,
      author_type: "member",
      author_id: callerMemberId,
      body: parsed.data.body,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: "could_not_post_message" }, { status: 500 });

  await broadcastTripChange(tripId, { type: "thread_message", threadId, message });

  // Same fire-and-forget pattern as the group message route — extraction
  // never blocks the member's send, and a thread-origin fact's receipt goes
  // back into this same thread (see postAgentMessage), never the group lane.
  after(async () => {
    const { data: authorMember } = await supabase.from("members").select().eq("id", callerMemberId).single();
    if (authorMember) {
      await runScribe({ tripId, message, authorMember, threadId });
    }
  });

  return NextResponse.json({ message }, { status: 201 });
}
