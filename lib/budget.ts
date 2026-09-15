// Budget facts store a raw per-head ceiling in INR directly (no bands — a
// fixed set of bands topping out at "20-35k" plus an unbounded "Open" meant
// anyone above that ceiling, or anyone who picked Open, couldn't be factored
// into a group ceiling at all).
export function groupBudgetCeiling(amounts: number[]): number | null {
  if (amounts.length === 0) return null;
  return Math.min(...amounts);
}
