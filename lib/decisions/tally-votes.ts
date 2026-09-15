import type { DecisionOption } from "../database.types";

type VoteLike = { option_id: string; is_veto: boolean };

export function tallyVotes(votes: VoteLike[]) {
  const counts = new Map<string, number>();
  const vetoedOptions = new Set<string>();
  for (const vote of votes) {
    counts.set(vote.option_id, (counts.get(vote.option_id) ?? 0) + 1);
    if (vote.is_veto) vetoedOptions.add(vote.option_id);
  }
  return { counts, vetoedOptions };
}

// Hard constraints are vetoes (spec §7.2): an option any member vetoed can never
// win the auto-pick, even with the most votes. Deterministic plain arithmetic —
// no LLM involved, per spec §7.4.
export function pickWinningOption(options: DecisionOption[], votes: VoteLike[]): string | null {
  const { counts, vetoedOptions } = tallyVotes(votes);
  let bestId: string | null = null;
  let bestCount = 0;
  for (const option of options) {
    if (vetoedOptions.has(option.id)) continue;
    const count = counts.get(option.id) ?? 0;
    if (count > bestCount) {
      bestCount = count;
      bestId = option.id;
    }
  }
  return bestId;
}
