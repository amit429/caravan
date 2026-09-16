export type MyVote = { optionId: string; isVeto: boolean } | null;

// Clicking the Vote/Veto button you're already in that exact state for
// removes your ballot — same toggle semantics idea votes already have.
// Clicking a different option, or the other action on the same option,
// replaces it instead. Pure so the optimistic-UI click handler and its
// tests don't have to fake a DOM to exercise this.
export function nextVoteAction(current: MyVote, optionId: string, isVeto: boolean): MyVote {
  if (current && current.optionId === optionId && current.isVeto === isVeto) return null;
  return { optionId, isVeto };
}
