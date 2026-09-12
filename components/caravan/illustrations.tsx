type IllustrationProps = {
  className?: string;
  size?: number;
};

const base = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

// A compass with the needle off true north — "you haven't picked a direction yet."
export function CompassIllustration({ className = "", size = 112 }: IllustrationProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" className={className} {...base}>
      <circle cx="48" cy="48" r="34" />
      <circle cx="48" cy="48" r="2.5" fill="currentColor" stroke="none" />
      <path d="M60 32 L44 44 L36 64 L52 52 Z" strokeLinejoin="round" />
      <path d="M48 10 L48 16" />
      <path d="M48 80 L48 86" />
      <path d="M10 48 L16 48" />
      <path d="M80 48 L86 48" />
    </svg>
  );
}

// A folded map with a dashed route and a pin — "nothing decided yet."
export function MapRouteIllustration({ className = "", size = 112 }: IllustrationProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" className={className} {...base}>
      <path d="M14 24 L34 16 L62 26 L82 18 L82 70 L62 78 L34 68 L14 76 Z" />
      <path d="M34 16 L34 68" />
      <path d="M62 26 L62 78" />
      <path d="M22 48 Q 40 36 50 48 T 74 40" strokeDasharray="1 7" />
      <circle cx="74" cy="40" r="5" fill="currentColor" stroke="none" />
    </svg>
  );
}

// Two overlapping speech bubbles, one carrying a checkmark — "threads and tasks."
export function ThreadIllustration({ className = "", size = 112 }: IllustrationProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" className={className} {...base}>
      <path d="M12 24 h44 a6 6 0 0 1 6 6 v24 a6 6 0 0 1 -6 6 h-30 l-14 12 v-12 h0 a6 6 0 0 1 -6 -6 v-24 a6 6 0 0 1 6 -6 Z" />
      <path d="M44 20 h34 a6 6 0 0 1 6 6 v20 a6 6 0 0 1 -6 6 h-4 v10 l-11 -10" />
      <path d="M26 36 L36 46 L54 30" transform="translate(0 6)" />
    </svg>
  );
}

// A simple closed gate — "not taking new members right now."
export function ClosedGateIllustration({ className = "", size = 112 }: IllustrationProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" className={className} {...base}>
      <path d="M20 30 L20 78" />
      <path d="M76 30 L76 78" />
      <path d="M20 34 L76 22" />
      <path d="M20 50 L76 38" />
      <path d="M20 66 L76 54" />
      <circle cx="48" cy="44" r="4" fill="currentColor" stroke="none" />
    </svg>
  );
}
