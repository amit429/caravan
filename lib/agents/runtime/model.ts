import { google } from "@ai-sdk/google";

// Single model everywhere (gemini-2.5-pro was deprecated for new users and
// broke Scout/Planner in production — see agent_runs for the AI_APICallError).
// Consolidated onto one Flash-tier model rather than re-pinning a separate
// Pro tier: gemini-3.6-flash beats gemini-3.5-flash on both price (cheaper
// output) and quality (fewer tokens per task, stronger multi-step reasoning),
// so there's no longer a case for a pricier Pro model for Scout/Planner's
// destination and itinerary reasoning. Swapping any task to a different
// model/provider later is still a one-line change since the AI SDK
// abstracts it.
export const flashModel = google("gemini-3.6-flash");

// Flash defaults to "thinking" mode, which burns tokens on multi-step
// reasoning the gate/extraction tasks don't need (measured: ~100 reasoning
// tokens for a single yes/no classification). Disabling it keeps the gate
// cheap and fast, which is the entire point of gating before extracting
// (spec §12.4).
export const fastGoogleOptions = {
  google: { thinkingConfig: { thinkingBudget: 0 } },
};

// Rough per-1M-token pricing for cost logging (agent_runs.cost), USD. Gemini
// list pricing as of this build — approximate on purpose, this is for budget
// visibility (spec §12.4), not billing. (Google runs temporary introductory
// discounts on this model from time to time; this uses the standard
// post-promo rate rather than chasing whatever's active right now.)
const PRICE_PER_MILLION_TOKENS: Record<string, { input: number; output: number }> = {
  "gemini-3.6-flash": { input: 1.5, output: 7.5 },
};

export function estimateCost(modelId: string, inputTokens: number, outputTokens: number): number {
  const price = PRICE_PER_MILLION_TOKENS[modelId];
  if (!price) return 0;
  return (inputTokens / 1_000_000) * price.input + (outputTokens / 1_000_000) * price.output;
}
