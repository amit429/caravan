// F16: a plain-text snapshot designed to be pasted into the group's existing
// WhatsApp thread (spec §7 Bet 2 — don't compete with WhatsApp, feed it).
// Deterministic string formatting, no LLM involved.
export function buildTripSummary(params: {
  tripName: string;
  destinationLabel: string | null;
  datesLabel: string | null;
  groupCeiling: number | null;
  checklist: { done: number; total: number } | null;
  inviteUrl: string;
}): string {
  const lines = [`🧭 *${params.tripName}*`];
  if (params.destinationLabel) lines.push(`📍 ${params.destinationLabel}`);
  if (params.datesLabel) lines.push(`📅 ${params.datesLabel}`);
  if (params.groupCeiling) lines.push(`💰 Under ₹${params.groupCeiling.toLocaleString("en-IN")}/head`);
  if (params.checklist && params.checklist.total > 0) {
    lines.push(`✅ ${params.checklist.done}/${params.checklist.total} prepped`);
  }
  lines.push(`👉 ${params.inviteUrl}`);
  return lines.join("\n");
}
