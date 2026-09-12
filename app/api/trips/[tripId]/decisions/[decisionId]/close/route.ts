import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { closeDecisionSchema } from "@/lib/validation";
import { pickWinningOption, tallyVotes } from "@/lib/tally-votes";
import { postAgentMessage } from "@/lib/agents/post-agent-message";
import type { DecisionOption } from "@/lib/database.types";

// Manual close (Phase 2 has no Chaser cron yet — the deadline is stored and
// shown, but locking a decision is always an explicit admin action here).
export async function POST(
  request: Request,
  { params }: { params: Promise<{ tripId: string; decisionId: string }> }
) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const { tripId, decisionId } = await params;
  const body = await request.json().catch(() => ({}));
  const parsed = closeDecisionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();
  const { data: decision } = await supabase
    .from("decisions")
    .select("id, state, options")
    .eq("id", decisionId)
    .eq("trip_id", tripId)
    .single();
  if (!decision) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (decision.state === "LOCKED") {
    return NextResponse.json({ error: "decision_already_locked" }, { status: 409 });
  }

  const { data: votes } = await supabase
    .from("votes")
    .select("option_id, is_veto, member_id")
    .eq("decision_id", decisionId);
  const options = decision.options as DecisionOption[];
  const { vetoedOptions } = tallyVotes(votes ?? []);

  const winningOptionId = parsed.data.optionId ?? pickWinningOption(options, votes ?? []);
  if (!winningOptionId) {
    return NextResponse.json({ error: "no_viable_option" }, { status: 400 });
  }
  if (vetoedOptions.has(winningOptionId) && !parsed.data.override) {
    return NextResponse.json(
      {
        error: "hard_constraint_blocks_option",
        message: "Someone marked this option as a hard no. Pick another option or override.",
      },
      { status: 409 }
    );
  }

  const { data: admin_member } = await supabase
    .from("members")
    .select("id")
    .eq("trip_id", tripId)
    .eq("email", admin.email)
    .maybeSingle();

  const { data: updated, error } = await supabase
    .from("decisions")
    .update({
      state: "LOCKED",
      locked_option: winningOptionId,
      locked_by: admin_member?.id ?? null,
      rationale: parsed.data.override ? "Locked by admin override, overriding a hard-constraint veto." : null,
    })
    .eq("id", decisionId)
    .select()
    .single();
  if (error) return NextResponse.json({ error: "could_not_lock_decision" }, { status: 500 });

  const winningLabel = options.find((o) => o.id === winningOptionId)?.label ?? winningOptionId;
  await postAgentMessage({
    tripId,
    agentName: "concierge",
    body: parsed.data.override
      ? `Locked: ${winningLabel}, by admin override.`
      : `Locked: ${winningLabel}.`,
  });

  return NextResponse.json({ decision: updated });
}
