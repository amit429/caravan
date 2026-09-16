import { logAgentRun } from "./runtime/log-run";
import { postAgentMessage } from "./runtime/post-agent-message";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { computeTopDateWindows } from "@/lib/dates/date-solver";
import type { AvailabilityRow, DecisionRow, MemberRow, TaskCategory } from "@/lib/database.types";

type QuartermasterResult = { ok: true } | { ok: false; reason: string };

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// Mirrors Planner's positional resolution of the locked DATES option back to
// a real date (spec: decisions only store a formatted label, not raw dates).
function resolveTripStartDate(
  datesDecision: DecisionRow | undefined,
  availability: AvailabilityRow[],
  activeMemberIds: string[],
  preferredDays: number
): string | null {
  if (!datesDecision?.locked_option) return null;
  const match = datesDecision.locked_option.match(/^window-(\d+)$/);
  if (!match) return null;
  const windows = computeTopDateWindows(availability, activeMemberIds, preferredDays);
  return windows[Number(match[1])]?.startDate ?? null;
}

// F13: no LLM here on purpose — a checklist template is not a generative
// task, it's the deterministic core doing what it's good at (spec §7.4).
// Runs once per trip; call again after tasks already exist and it declines
// rather than duplicating rows (no edit/regenerate UI built yet).
export async function runQuartermaster(tripId: string): Promise<QuartermasterResult> {
  const supabase = createServiceSupabaseClient();
  const { data: decisions } = await supabase.from("decisions").select().eq("trip_id", tripId);
  const allDecisions = (decisions ?? []) as DecisionRow[];

  const destinationDecision = allDecisions.find((d) => d.type === "DESTINATION" && d.state === "LOCKED");
  const datesDecision = allDecisions.find((d) => d.type === "DATES" && d.state === "LOCKED");
  if (!destinationDecision || !datesDecision) {
    return { ok: false, reason: "Lock a destination and dates before generating a checklist." };
  }

  const { data: existingTasks } = await supabase.from("tasks").select("id").eq("trip_id", tripId);
  if ((existingTasks ?? []).length > 0) {
    return { ok: false, reason: "Checklist already exists for this trip." };
  }

  const destination =
    destinationDecision.options.find((o) => o.id === destinationDecision.locked_option)?.label ?? "the destination";

  const { data: members } = await supabase.from("members").select().eq("trip_id", tripId).eq("status", "active");
  const activeMembers = (members ?? []) as MemberRow[];

  const [{ data: availability }, { data: trip }] = await Promise.all([
    supabase.from("availability").select().eq("trip_id", tripId),
    supabase.from("trips").select("preferred_trip_days").eq("id", tripId).single(),
  ]);
  const startDate = resolveTripStartDate(
    datesDecision,
    (availability ?? []) as AvailabilityRow[],
    activeMembers.map((m) => m.id),
    (trip as { preferred_trip_days: number } | null)?.preferred_trip_days ?? 7
  );

  type NewTask = { trip_id: string; member_id: string | null; title: string; category: TaskCategory; due_date: string | null };
  const rows: NewTask[] = [];

  for (const member of activeMembers) {
    rows.push({
      trip_id: tripId,
      member_id: member.id,
      title: "Confirm ID / passport is valid",
      category: "docs",
      due_date: startDate ? addDays(startDate, -14) : null,
    });
    rows.push({
      trip_id: tripId,
      member_id: member.id,
      title: `Book your travel to ${destination}`,
      category: "booking",
      due_date: startDate ? addDays(startDate, -14) : null,
    });
    rows.push({
      trip_id: tripId,
      member_id: member.id,
      title: "Pack",
      category: "packing",
      due_date: startDate ? addDays(startDate, -1) : null,
    });
  }
  rows.push({
    trip_id: tripId,
    member_id: null,
    title: "Confirm final headcount",
    category: "other",
    due_date: startDate ? addDays(startDate, -7) : null,
  });

  const start = Date.now();
  const { error } = await supabase.from("tasks").insert(rows);
  if (error) {
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
    return { ok: false, reason: "Something went wrong generating the checklist. Try again." };
  }

  await logAgentRun({
    tripId,
    agent: "quartermaster",
    trigger: "admin.request",
    inputTokens: 0,
    outputTokens: 0,
    cost: 0,
    latencyMs: Date.now() - start,
    outcome: "success",
  });

  await postAgentMessage({
    tripId,
    agentName: "quartermaster",
    body: `Checklist's up — ${rows.length - 1} tasks split across the group for ${destination}. Check Plan.`,
  });

  return { ok: true };
}
