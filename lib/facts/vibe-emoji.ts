export const VIBE_EMOJI: Record<string, string> = {
  Beach: "🏖️",
  Mountains: "⛰️",
  Party: "🎉",
  Slow: "🌙",
  "Road trip": "🚗",
  Food: "🍜",
  Trekking: "🥾",
  Cities: "🏙️",
};

export function vibeEmoji(tag: string): string {
  return VIBE_EMOJI[tag] ?? "✨";
}
