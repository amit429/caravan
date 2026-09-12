import type { DecisionRow, MemberRow } from "@/lib/database.types";

const HOUR_MS = 60 * 60 * 1000;
const REMINDER_WINDOW_HOURS = 24;

const OPEN_STATES = new Set<DecisionRow["state"]>(["OPEN", "VOTING"]);

// Deterministic core, LLM shell (spec §7.4) — Chaser is pure rules, no
// language model involved anywhere in this file.
export function isPastDeadline(decision: DecisionRow, now: Date): boolean {
  if (!decision.deadline || !OPEN_STATES.has(decision.state)) return false;
  return new Date(decision.deadline).getTime() <= now.getTime();
}

export function needsDeadlineReminder(decision: DecisionRow, now: Date): boolean {
  if (!decision.deadline || !OPEN_STATES.has(decision.state) || decision.reminded_at) return false;
  const msUntilDeadline = new Date(decision.deadline).getTime() - now.getTime();
  return msUntilDeadline > 0 && msUntilDeadline <= REMINDER_WINDOW_HOURS * HOUR_MS;
}

export type NudgeTier = 1 | 2 | 3;

// D6's silence ladder — 24h nudge, 48h second nudge with an opt-out, 72h
// flagged to the admin. No thread/private-lane infra exists yet, so these
// currently post to the group board instead of privately — a disclosed
// simplification of the spec's original design, not the intended end state.
export function nextNudgeTier(member: MemberRow, hasCompletedIntake: boolean, now: Date): NudgeTier | null {
  if (hasCompletedIntake) return null;
  const hoursSinceJoin = (now.getTime() - new Date(member.joined_at).getTime()) / HOUR_MS;
  if (member.nudge_tier < 1 && hoursSinceJoin >= 24) return 1;
  if (member.nudge_tier < 2 && hoursSinceJoin >= 48) return 2;
  if (member.nudge_tier < 3 && hoursSinceJoin >= 72) return 3;
  return null;
}
