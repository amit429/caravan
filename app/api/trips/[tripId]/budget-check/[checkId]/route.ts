import { NextResponse } from "next/server";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { resolveCaller, callerAuthError } from "@/lib/auth/resolve-caller";
import { broadcastTripChange } from "@/lib/realtime/broadcast";
import { postAgentMessage } from "@/lib/agents/runtime/post-agent-message";
import { ensureThread } from "@/lib/threads/ensure-thread";
import { budgetCheckAnswerSchema } from "@/lib/validation";
import type { BudgetCheckRow } from "@/lib/database.types";

// A member can only ever answer their own budget check — same "only you can
// touch your own budget data" rule as facts/[factId] (docs/design/screens.html
// E2), extended to this flow since it's the same private-input surface.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ tripId: string; checkId: string }> }
) {
  const { tripId, checkId } = await params;
  const supabase = createServiceSupabaseClient();
  const caller = await resolveCaller(tripId, supabase);
  const authError = callerAuthError(caller);
  if (authError) return authError;

  const body = await request.json();
  const parsed = budgetCheckAnswerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { data: check } = await supabase
    .from("budget_checks")
    .select()
    .eq("id", checkId)
    .eq("trip_id", tripId)
    .maybeSingle();
  if (!check) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const checkRow = check as BudgetCheckRow;
  if (checkRow.member_id !== caller!.id) return NextResponse.json({ error: "not_your_check" }, { status: 403 });
  if (checkRow.status !== "pending") return NextResponse.json({ error: "already_answered" }, { status: 409 });

  const threadId = await ensureThread(tripId, caller!.id, supabase);

  // The interactive card in the thread reads its state from the message's
  // own metadata (frozen at insert time) — patch it here so a reload
  // doesn't show the buttons again on a check that's already been answered.
  const { data: originalMessage } = await supabase
    .from("messages")
    .select("id, metadata")
    .eq("trip_id", tripId)
    .contains("metadata", { budgetCheckId: checkId })
    .maybeSingle();
  if (originalMessage) {
    await supabase
      .from("messages")
      .update({ metadata: { ...(originalMessage.metadata as Record<string, unknown>), status: parsed.data.answer } })
      .eq("id", originalMessage.id);
  }

  if (parsed.data.answer === "yes") {
    await supabase.from("budget_checks").update({ status: "yes", answered_at: new Date().toISOString() }).eq("id", checkId);

    const { data: inserted } = await supabase
      .from("facts")
      .insert({
        trip_id: tripId,
        member_id: caller!.id,
        category: "budget",
        type: "SOFT",
        value: { amount: checkRow.threshold_amount },
        confidence: 1,
        source: "manual",
      })
      .select("id")
      .single();
    if (inserted) {
      await supabase
        .from("facts")
        .update({ superseded_by: inserted.id })
        .eq("trip_id", tripId)
        .eq("member_id", caller!.id)
        .eq("category", "budget")
        .is("superseded_by", null)
        .neq("id", inserted.id);
    }

    await postAgentMessage({
      tripId,
      agentName: "quartermaster",
      threadId,
      body: `Got it — updated your budget to ₹${checkRow.threshold_amount.toLocaleString("en-IN")}. Thanks for flexing a bit.`,
    });
  } else {
    await supabase
      .from("budget_checks")
      .update({ status: "no", reason: parsed.data.reason, answered_at: new Date().toISOString() })
      .eq("id", checkId);

    await postAgentMessage({
      tripId,
      agentName: "quartermaster",
      threadId,
      body: `Got it — letting the admin know so the group can figure out a path forward.`,
    });

    const { data: member } = await supabase.from("members").select("display_name").eq("id", caller!.id).single();
    await postAgentMessage({
      tripId,
      agentName: "quartermaster",
      body: `${member?.display_name ?? "Someone"} can't stretch their budget for this trip — reason: "${parsed.data.reason}". Might be worth coordinating budgets, adjusting dates, or looking at cheaper stays.`,
    });
  }

  await broadcastTripChange(tripId);
  return NextResponse.json({ ok: true });
}
