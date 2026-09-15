import { generateObject } from "ai";
import { z } from "zod";
import { flashModel, estimateCost } from "./model";
import { logAgentRun } from "./log-run";
import { postAgentMessage } from "./post-agent-message";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { computeTopDateWindows } from "@/lib/date-solver";
import type { AvailabilityRow, DecisionRow, FactRow, ItineraryDay, MemberRow } from "@/lib/database.types";

const MODEL_ID = "gemini-3.6-flash";
const DEFAULT_TRIP_LENGTH_DAYS = 4;

const activitySchema = z.object({ time: z.string(), description: z.string() });
const dayPlanSchema = z.object({
  day: z.number().int().min(1),
  title: z.string(),
  activities: z.array(activitySchema).min(3).max(6),
});
const plannerOutputSchema = z.object({ days: z.array(dayPlanSchema).min(1).max(10) });

type PlannerResult = { ok: true } | { ok: false; reason: string };

// The locked DATES decision only stores a formatted label ("Nov 12 – Nov 15"),
// not raw dates — its option id ("window-N") is positional against the date
// solver's output at creation time, so re-running the solver now recovers the
// real start/end dates as long as availability hasn't shifted the ranking
// since. Falls back to a default length if that assumption doesn't hold.
function resolveTripLengthDays(
  datesDecision: DecisionRow | undefined,
  availability: AvailabilityRow[],
  activeMemberIds: string[]
): number {
  if (!datesDecision?.locked_option) return DEFAULT_TRIP_LENGTH_DAYS;
  const match = datesDecision.locked_option.match(/^window-(\d+)$/);
  if (!match) return DEFAULT_TRIP_LENGTH_DAYS;
  const windows = computeTopDateWindows(availability, activeMemberIds);
  const window = windows[Number(match[1])];
  if (!window) return DEFAULT_TRIP_LENGTH_DAYS;
  const days = Math.round(
    (new Date(`${window.endDate}T00:00:00Z`).getTime() - new Date(`${window.startDate}T00:00:00Z`).getTime()) /
      (24 * 60 * 60 * 1000)
  );
  return days + 1;
}

// F11: day-by-day itinerary from the locked destination, honouring party size
// and vibe/pace. Editing individual days is out of scope this pass — this
// generates and regenerates the whole thing, it doesn't support inline edits.
export async function runPlanner(tripId: string): Promise<PlannerResult> {
  const supabase = createServiceSupabaseClient();
  const [{ data: decisions }, { data: members }, { data: facts }, { data: availability }] = await Promise.all([
    supabase.from("decisions").select().eq("trip_id", tripId),
    supabase.from("members").select().eq("trip_id", tripId).eq("status", "active"),
    supabase.from("facts").select().eq("trip_id", tripId).is("superseded_by", null),
    supabase.from("availability").select().eq("trip_id", tripId),
  ]);

  const allDecisions = (decisions ?? []) as DecisionRow[];
  const destinationDecision = allDecisions.find((d) => d.type === "DESTINATION" && d.state === "LOCKED");
  if (!destinationDecision) {
    return { ok: false, reason: "Lock a destination before generating an itinerary." };
  }
  const destination =
    destinationDecision.options.find((o) => o.id === destinationDecision.locked_option)?.label ?? "the destination";

  const activeMembers = (members ?? []) as MemberRow[];
  const datesDecision = allDecisions.find((d) => d.type === "DATES" && d.state === "LOCKED");
  const tripLengthDays = resolveTripLengthDays(
    datesDecision,
    (availability ?? []) as AvailabilityRow[],
    activeMembers.map((m) => m.id)
  );

  const allFacts = (facts ?? []) as FactRow[];
  const vibeTags = [
    ...new Set(allFacts.filter((f) => f.category === "vibe").flatMap((f) => (f.value as { tags: string[] }).tags)),
  ];
  const hardNos = allFacts
    .filter((f) => f.category === "hard_no")
    .flatMap((f) => (f.value as { items: string[] }).items);

  const prompt = `Build a ${tripLengthDays}-day itinerary for a group trip to ${destination}. Party size: ${activeMembers.length}. Vibe: ${
    vibeTags.join(", ") || "unspecified"
  }. Hard constraints that must never be violated by any activity: ${hardNos.join("; ") || "none"}.

For each day, give a short title/theme and 3-5 time-blocked activities. Keep pace realistic for a group — go lighter if the vibe suggests "Slow", pack more in if it suggests "Party", "Trekking", or "Road trip".`;

  const start = Date.now();
  let result: Awaited<ReturnType<typeof generateObject<typeof plannerOutputSchema>>>;
  try {
    result = await generateObject({ model: flashModel, schema: plannerOutputSchema, prompt });
  } catch (error) {
    await logAgentRun({
      tripId,
      agent: "planner",
      trigger: "admin.request",
      inputTokens: 0,
      outputTokens: 0,
      cost: 0,
      latencyMs: Date.now() - start,
      outcome: "error",
      errorMessage: String(error),
    });
    return { ok: false, reason: "Something went wrong generating the itinerary. Try again." };
  }

  await logAgentRun({
    tripId,
    agent: "planner",
    trigger: "admin.request",
    inputTokens: result.usage.inputTokens ?? 0,
    outputTokens: result.usage.outputTokens ?? 0,
    cost: estimateCost(MODEL_ID, result.usage.inputTokens ?? 0, result.usage.outputTokens ?? 0),
    latencyMs: Date.now() - start,
    outcome: "success",
  });

  const days: ItineraryDay[] = result.object.days.map((d) => ({
    day: d.day,
    date: null,
    title: d.title,
    activities: d.activities,
  }));

  await supabase
    .from("itineraries")
    .upsert(
      { trip_id: tripId, destination, days, updated_at: new Date().toISOString() },
      { onConflict: "trip_id" }
    );

  await postAgentMessage({
    tripId,
    agentName: "planner",
    body: `Itinerary's up: ${tripLengthDays} days in ${destination}. Check Plan.`,
  });

  return { ok: true };
}
