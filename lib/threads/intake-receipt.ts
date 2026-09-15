// The PRD's "confirms what it heard" pattern (docs/design/screens.html F/D2)
// — a short, specific receipt beats a generic "saved!", and it's what makes
// the thread read as the agent actually listening rather than a form
// swallowing input silently.
export function buildIntakeReceipt(input: {
  budgetBand: string;
  departureCity: string;
  vibe: string[];
  hardNos: string[];
}): string {
  const parts = [`${input.budgetBand} budget`, `from ${input.departureCity}`];
  if (input.vibe.length > 0) parts.push(`${input.vibe.join(" + ")} vibe`);

  let receipt = `Got it — ${parts.join(", ")}.`;
  if (input.hardNos.length > 0) {
    const label = input.hardNos.length === 1 ? "hard no" : "hard nos";
    receipt += ` Filed ${input.hardNos.length} ${label} too.`;
  }
  return receipt;
}
