const BAND_CEILINGS: Record<string, number> = {
  "Under 10k": 10000,
  "10-20k": 20000,
  "20-35k": 35000,
};

export function budgetBandCeiling(band: string): number | null {
  return BAND_CEILINGS[band] ?? null;
}

// The group ceiling is whoever's tightest, since that's who the plan actually
// has to fit under (spec §7.1 Bet 2) — not an average, a floor.
export function groupBudgetCeiling(bands: string[]): number | null {
  const bounded = bands.map(budgetBandCeiling).filter((n): n is number => n !== null);
  if (bounded.length === 0) return null;
  return Math.min(...bounded);
}
