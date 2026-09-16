import { generateObject } from "ai";
import { z } from "zod";
import { flashModel, estimateCost } from "./runtime/model";
import { logAgentRun } from "./runtime/log-run";
import { postAgentMessage } from "./runtime/post-agent-message";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { flagMembersOverBudget } from "@/lib/budget/cost-flags";
import { triggerBudgetChecks } from "@/lib/budget/trigger-budget-checks";
import type { DecisionRow, FactRow } from "@/lib/database.types";

const MODEL_ID = "gemini-3.6-flash";

const estimateSchema = z.object({
  minPerHead: z.number().positive(),
  maxPerHead: z.number().positive(),
  assumptions: z.string(),
});

type CostEstimatorResult = { ok: true } | { ok: false; reason: string };

// F15: a single per-head range for the locked destination, then a purely
// deterministic comparison against each member's private budget ceiling
// (spec §7.4) — the LLM never decides who's "over," it only estimates cost.
export async function runCostEstimator(tripId: string): Promise<CostEstimatorResult> {
  const supabase = createServiceSupabaseClient();
  const [{ data: decisions }, { data: members }, { data: facts }] = await Promise.all([
    supabase.from("decisions").select().eq("trip_id", tripId),
    supabase.from("members").select().eq("trip_id", tripId).eq("status", "active"),
    supabase.from("facts").select().eq("trip_id", tripId).is("superseded_by", null),
  ]);

  const allDecisions = (decisions ?? []) as DecisionRow[];
  const destinationDecision = allDecisions.find((d) => d.type === "DESTINATION" && d.state === "LOCKED");
  if (!destinationDecision) {
    return { ok: false, reason: "Lock a destination before estimating cost." };
  }
  const destination =
    destinationDecision.options.find((o) => o.id === destinationDecision.locked_option)?.label ?? "the destination";

  const partySize = (members ?? []).length;
  const allFacts = (facts ?? []) as FactRow[];
  const vibeTags = [
    ...new Set(allFacts.filter((f) => f.category === "vibe").flatMap((f) => (f.value as { tags: string[] }).tags)),
  ];

  const prompt = `Estimate a realistic per-head cost range in INR for a group trip to ${destination}. Party size: ${partySize}. Vibe: ${
    vibeTags.join(", ") || "unspecified"
  }. Include travel, stay, food, and activities. Give a "minPerHead" and "maxPerHead" (integers, INR) and one-sentence "assumptions" describing what's included.`;

  const start = Date.now();
  let result: Awaited<ReturnType<typeof generateObject<typeof estimateSchema>>>;
  try {
    result = await generateObject({ model: flashModel, schema: estimateSchema, prompt });
  } catch (error) {
    await logAgentRun({
      tripId,
      agent: "quartermaster",
      trigger: "admin.request",
      inputTokens: 0,
      outputTokens: 0,
      cost: 0,
      latencyMs: Date.now() - start,
      outcome: "error",
      errorMessage: String(error),
    });
    return { ok: false, reason: "Something went wrong estimating cost. Try again." };
  }

  await logAgentRun({
    tripId,
    agent: "quartermaster",
    trigger: "admin.request",
    inputTokens: result.usage.inputTokens ?? 0,
    outputTokens: result.usage.outputTokens ?? 0,
    cost: estimateCost(MODEL_ID, result.usage.inputTokens ?? 0, result.usage.outputTokens ?? 0),
    latencyMs: Date.now() - start,
    outcome: "success",
  });

  const { minPerHead, maxPerHead, assumptions } = result.object;

  await supabase.from("cost_estimates").upsert(
    {
      trip_id: tripId,
      destination,
      min_per_head: minPerHead,
      max_per_head: maxPerHead,
      assumptions,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "trip_id" }
  );

  const memberCeilings = allFacts
    .filter((f) => f.category === "budget")
    .map((f) => ({ memberId: f.member_id, ceiling: (f.value as { amount: number }).amount }));
  const flagged = flagMembersOverBudget({ minPerHead, maxPerHead }, memberCeilings);

  const rangeText = `₹${minPerHead.toLocaleString("en-IN")}–${maxPerHead.toLocaleString("en-IN")} per head for ${destination}`;
  const body =
    flagged.length > 0
      ? `Estimate: ${rangeText}. Heads up — this pushes ${flagged.length} ${flagged.length === 1 ? "person" : "people"} over their limit.`
      : `Estimate: ${rangeText}. Everyone's ceiling covers it.`;

  await postAgentMessage({ tripId, agentName: "quartermaster", body });

  if (flagged.length > 0) {
    await triggerBudgetChecks(tripId, { minPerHead, maxPerHead });
  }

  return { ok: true };
}
