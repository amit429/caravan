import { google } from "@ai-sdk/google";

// Cost routed by task, not one model everywhere (PRD §12.2): cheap/fast for the
// gate check and Scribe's extraction, a stronger model for Scout's destination
// reasoning. Both are Gemini for now — swapping Scout to Claude later is a
// one-line change since the AI SDK abstracts the provider.
export const flashModel = google("gemini-2.5-flash");
export const proModel = google("gemini-2.5-pro");

// Rough per-1M-token pricing for cost logging (agent_runs.cost), USD. Gemini
// Flash/Pro list pricing as of this build — approximate on purpose, this is
// for budget visibility (spec §12.4), not billing.
const PRICE_PER_MILLION_TOKENS: Record<string, { input: number; output: number }> = {
  "gemini-2.5-flash": { input: 0.3, output: 2.5 },
  "gemini-2.5-pro": { input: 1.25, output: 10 },
};

export function estimateCost(modelId: string, inputTokens: number, outputTokens: number): number {
  const price = PRICE_PER_MILLION_TOKENS[modelId];
  if (!price) return 0;
  return (inputTokens / 1_000_000) * price.input + (outputTokens / 1_000_000) * price.output;
}
