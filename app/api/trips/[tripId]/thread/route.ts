import { NextResponse, after } from "next/server";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { resolveCaller, callerAuthError } from "@/lib/auth/resolve-caller";
import { ensureThread } from "@/lib/threads/ensure-thread";
import { loadThread } from "@/lib/threads/load-thread";
import { runScribe } from "@/lib/agents/scribe";
import { answerTripQuestion } from "@/lib/agents/answer-question";
import { postAgentMessage } from "@/lib/agents/runtime/post-agent-message";
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

  // Same fire-and-forget pattern as the group message route — nothing here
  // blocks the member's send. "Ask the agent" (D3) skips Scribe entirely: a
  // question isn't a fact statement, and running both would double the LLM
  // calls for no reason.
  //
  // For a plain-chat message, Scribe already posts a receipt whenever it
  // files something — but when there's nothing to file (small talk, a
  // question the member never routed through the explicit "ask" sheet),
  // this used to just... stop. That's the exact "I type something in You
  // and nothing happens" bug: a private 1:1 thread should never go silent
  // the way the shared group feed intentionally does. Falling back to the
  // same conversational answer "ask" uses closes that gap without touching
  // the group Room, which is right to stay quiet on plain chatter.
  if (parsed.data.intent === "ask") {
    after(async () => {
      const answer = await answerTripQuestion(tripId, parsed.data.body);
      await postAgentMessage({ tripId, agentName: "concierge", body: answer, threadId });
    });
  } else {
    after(async () => {
      const { data: authorMember } = await supabase.from("members").select().eq("id", callerMemberId).single();
      if (!authorMember) return;
      const { posted } = await runScribe({ tripId, message, authorMember, threadId });
      if (!posted) {
        const answer = await answerTripQuestion(tripId, parsed.data.body);
        await postAgentMessage({ tripId, agentName: "concierge", body: answer, threadId });
      }
    });
  }

  return NextResponse.json({ message }, { status: 201 });
}
