// Pure arithmetic (spec §7.4) — the LLM estimates the range, this just
// compares it against each member's private ceiling. Uses the midpoint of
// the estimate, not the upper bound — comparing against the pessimistic max
// flagged nearly everyone whenever the range was wide (which Gemini's
// estimates usually are), making the whole section read as "everyone's
// always over," not a useful signal. The midpoint is the best single-number
// read of "what this will probably actually cost."
export function budgetCheckThreshold(estimate: { minPerHead: number; maxPerHead: number }): number {
  return Math.round((estimate.minPerHead + estimate.maxPerHead) / 2);
}

export function flagMembersOverBudget(
  estimate: { minPerHead: number; maxPerHead: number },
  memberCeilings: { memberId: string; ceiling: number }[]
): string[] {
  const threshold = budgetCheckThreshold(estimate);
  return memberCeilings.filter((m) => m.ceiling < threshold).map((m) => m.memberId);
}
