// Pure arithmetic (spec §7.4) — the LLM estimates the range, this just
// compares it against each member's private ceiling. Uses the upper bound
// since that's the conservative reading of "does this fit."
export function flagMembersOverBudget(
  maxPerHead: number,
  memberCeilings: { memberId: string; ceiling: number }[]
): string[] {
  return memberCeilings.filter((m) => m.ceiling < maxPerHead).map((m) => m.memberId);
}
