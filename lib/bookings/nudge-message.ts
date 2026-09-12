// Pure and deterministic — the nudge just names who's outstanding, no LLM
// judgment involved (spec §7.4).
export function buildNudgeMessage(item: string, unbookedNames: string[]): string | null {
  if (unbookedNames.length === 0) return null;
  return `Still waiting on ${item} from ${unbookedNames.join(", ")}.`;
}
