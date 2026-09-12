import { generateObject } from "ai";
import { z } from "zod";
import { proModel, estimateCost } from "./model";
import { logAgentRun } from "./log-run";
import { postAgentMessage } from "./post-agent-message";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { groupBudgetCeiling } from "@/lib/budget";
import type { FactRow } from "@/lib/database.types";

const MODEL_ID = "gemini-2.5-pro";

const destinationOptionSchema = z.object({
  id: z.string(),
  label: z.string(),
  costPerHead: z.string(),
  travelTime: z.string(),
  whyFits: z.string(),
  whoFitsWorst: z.string(),
});

const scoutOutputSchema = z.object({ options: z.array(destinationOptionSchema).length(3) });

async function searchTavily(query: string): Promise<string> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) return "";
  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ api_key: apiKey, query, max_results: 5 }),
    });
    if (!res.ok) return "";
    const data = await res.json();
    const results = (data.results ?? []) as { title: string; content: string }[];
    return results.map((r) => `${r.title}: ${r.content}`).join("\n");
  } catch {
    // Web search is enrichment, not a dependency — Scout still works from the
    // model's own knowledge if Tavily is unset or unreachable (graceful
    // degradation, spec §12.4).
    return "";
  }
}

type ScoutResult = { ok: true } | { ok: false; reason: string };

// The "hero moment" (F8): 3 destination options with real tradeoff commentary,
// gated on having enough constraints to say something real rather than
// generic (spec D2 — never propose from thin constraints).
export async function runScout(tripId: string): Promise<ScoutResult> {
  const supabase = createServiceSupabaseClient();
  const [{ data: members }, { data: facts }] = await Promise.all([
    supabase.from("members").select().eq("trip_id", tripId).eq("status", "active"),
    supabase.from("facts").select().eq("trip_id", tripId).is("superseded_by", null),
  ]);

  const allFacts = (facts ?? []) as FactRow[];
  const budgetBands = allFacts.filter((f) => f.category === "budget").map((f) => (f.value as { band: string }).band);
  const groupCeiling = groupBudgetCeiling(budgetBands);
  if (!groupCeiling) {
    return { ok: false, reason: "Need at least one budget answer before suggesting anywhere real." };
  }

  const departureCities = [
    ...new Set(
      allFacts.filter((f) => f.category === "departure_city").map((f) => (f.value as { city: string }).city)
    ),
  ];
  const vibeTags = [
    ...new Set(allFacts.filter((f) => f.category === "vibe").flatMap((f) => (f.value as { tags: string[] }).tags)),
  ];
  const hardNos = allFacts
    .filter((f) => f.category === "hard_no")
    .flatMap((f) => (f.value as { items: string[] }).items);

  const searchQuery = `budget group trip ideas ${vibeTags.join(" ")} under ₹${groupCeiling} per person from ${
    departureCities.join(" or ") || "India"
  }`;
  const searchContext = await searchTavily(searchQuery);

  const prompt = `Suggest exactly 3 destination options for a group trip. Party size: ${(members ?? []).length}. Group budget ceiling: ₹${groupCeiling} per head — do not exceed this in any option. Departure cities: ${
    departureCities.join(", ") || "unspecified"
  }. Vibe: ${vibeTags.join(", ") || "unspecified"}. Hard constraints that must never be violated by any option: ${
    hardNos.join("; ") || "none"
  }.
${searchContext ? `\nRecent research:\n${searchContext}` : ""}

For each option give: the destination name, an estimated cost per head range in INR, rough travel time from the group's departure cities, why it fits this specific group (1-2 sentences, reference their actual vibe/budget), and who it fits worst (1 honest sentence naming the tradeoff — describe the type of person, e.g. "whoever wanted nightlife", never invent a real name).`;

  const start = Date.now();
  let result: Awaited<ReturnType<typeof generateObject<typeof scoutOutputSchema>>>;
  try {
    result = await generateObject({ model: proModel, schema: scoutOutputSchema, prompt });
  } catch (error) {
    await logAgentRun({
      tripId,
      agent: "scout",
      trigger: "admin.request",
      inputTokens: 0,
      outputTokens: 0,
      cost: 0,
      latencyMs: Date.now() - start,
      outcome: "error",
      errorMessage: String(error),
    });
    return { ok: false, reason: "Something went wrong generating options. Try again." };
  }

  await logAgentRun({
    tripId,
    agent: "scout",
    trigger: "admin.request",
    inputTokens: result.usage.inputTokens ?? 0,
    outputTokens: result.usage.outputTokens ?? 0,
    cost: estimateCost(MODEL_ID, result.usage.inputTokens ?? 0, result.usage.outputTokens ?? 0),
    latencyMs: Date.now() - start,
    outcome: "success",
  });

  const options = result.object.options.map((opt, i) => ({
    id: opt.id || `option-${i}`,
    label: opt.label,
    meta: {
      costPerHead: opt.costPerHead,
      travelTime: opt.travelTime,
      whyFits: opt.whyFits,
      whoFitsWorst: opt.whoFitsWorst,
    },
  }));

  await supabase.from("decisions").insert({
    trip_id: tripId,
    type: "DESTINATION",
    state: "OPEN",
    options,
    quorum_rule: "simple_majority",
    default_on_silence: "none",
  });

  await postAgentMessage({
    tripId,
    agentName: "scout",
    body: `Three options: ${options.map((o) => o.label).join(", ")}. Details in Plan.`,
  });

  return { ok: true };
}
