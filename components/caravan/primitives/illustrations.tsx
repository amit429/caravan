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

// A suitcase with a boarding-pass tag — "nothing booked or tracked yet."
export function SuitcaseIllustration({ className = "", size = 112 }: IllustrationProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" className={className} {...base}>
      <rect x="16" y="34" width="64" height="42" rx="6" />
      <path d="M36 34 v-8 a6 6 0 0 1 6 -6 h12 a6 6 0 0 1 6 6 v8" />
      <path d="M16 52 h64" />
      <path d="M62 24 L80 20 L78 34" />
    </svg>
  );
}

// A pin dropping onto a card — "nothing pasted in yet."
export function BookmarkIllustration({ className = "", size = 112 }: IllustrationProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" className={className} {...base}>
      <rect x="16" y="20" width="64" height="48" rx="8" />
      <path d="M30 34 h36" />
      <path d="M30 44 h24" />
      <path d="M62 62 v22 l10 -8 l10 8 v-22" strokeLinejoin="round" />
    </svg>
  );
}

// A torn receipt with a rupee mark — "nothing costed out yet."
export function ReceiptIllustration({ className = "", size = 112 }: IllustrationProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" className={className} {...base}>
      <path d="M26 12 h44 v66 l-8 -6 l-8 6 l-8 -6 l-8 6 l-8 -6 l-8 6 Z" strokeLinejoin="round" />
      <path d="M36 30 h24" />
      <path d="M36 42 h24" />
      <path d="M36 54 h14" />
    </svg>
  );
}

// An open doorway with a couple of balloons drifting by it — "the room's
// still shut, but people are gathering outside."
export function LobbyIllustration({ className = "", size = 112 }: IllustrationProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" className={className} {...base}>
      <path d="M28 84 V40 a20 20 0 0 1 40 0 V84" />
      <path d="M18 84 H78" />
      <circle cx="68" cy="20" r="9" />
      <path d="M68 29 Q66 38 70 44" />
      <circle cx="19" cy="30" r="7" />
      <path d="M19 37 Q21 44 17 50" />
    </svg>
  );
}

// A calendar page with a little sun on it — "pick your good days."
export function SunCalendarIllustration({ className = "", size = 112 }: IllustrationProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" className={className} {...base}>
      <rect x="14" y="22" width="68" height="58" rx="8" />
      <path d="M14 38 H82" />
      <path d="M30 14 V26" />
      <path d="M66 14 V26" />
      <circle cx="48" cy="59" r="9" />
      <path d="M48 43 V47" />
      <path d="M48 71 V75" />
      <path d="M32 59 H36" />
      <path d="M60 59 H64" />
    </svg>
  );
}

// A wallet with a coin tucked in the clasp — "what can you spend, privately."
export function WalletIllustration({ className = "", size = 112 }: IllustrationProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" className={className} {...base}>
      <path d="M14 30 h56 a8 8 0 0 1 8 8 v34 a8 8 0 0 1 -8 8 h-56 a8 8 0 0 1 -8 -8 v-34 a8 8 0 0 1 8 -8 Z" />
      <path d="M14 30 L24 20 H68" />
      <circle cx="65" cy="55" r="5" fill="currentColor" stroke="none" />
    </svg>
  );
}

// A signpost with two boards pointing opposite ways — "where are you coming from."
export function SignpostIllustration({ className = "", size = 112 }: IllustrationProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" className={className} {...base}>
      <path d="M48 20 V86" />
      <path d="M48 30 H78 L70 40 L78 50 H48 Z" strokeLinejoin="round" />
      <path d="M48 46 H18 L26 56 L18 66 H48 Z" strokeLinejoin="round" />
    </svg>
  );
}

// A sun over a rolling shoreline — "what are you actually after."
export function SunWaveIllustration({ className = "", size = 112 }: IllustrationProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" className={className} {...base}>
      <circle cx="48" cy="36" r="13" />
      <path d="M48 12 V17" />
      <path d="M48 55 V60" />
      <path d="M24 36 H29" />
      <path d="M67 36 H72" />
      <path d="M68.5 19.5 L65 23" />
      <path d="M31 23 L27.5 19.5" />
      <path d="M12 74 Q22 62 32 74 T52 74 T72 74 T92 74" />
    </svg>
  );
}

// A shield with a line struck through the middle — "this blocks an option, no vote overrides it."
export function ShieldIllustration({ className = "", size = 112 }: IllustrationProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" className={className} {...base}>
      <path d="M48 12 L78 24 V49 C78 67 64 79 48 86 C32 79 18 67 18 49 V24 Z" strokeLinejoin="round" />
      <path d="M37 37 L59 59" />
      <path d="M59 37 L37 59" />
    </svg>
  );
}

// A party popper mid-burst — the "you're done" celebration.
export function PartyPopperIllustration({ className = "", size = 112 }: IllustrationProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" className={className} {...base}>
      <path d="M24 72 L54 42 L66 54 L36 84 Z" strokeLinejoin="round" />
      <path d="M58 20 V28" />
      <path d="M72 32 L65 36" />
      <path d="M76 46 H68" />
      <circle cx="68" cy="18" r="2.5" fill="currentColor" stroke="none" />
      <circle cx="82" cy="38" r="2" fill="currentColor" stroke="none" />
      <circle cx="50" cy="16" r="2" fill="currentColor" stroke="none" />
    </svg>
  );
}

// A clipboard with one item checked off — "nothing on the list yet."
export function ChecklistIllustration({ className = "", size = 112 }: IllustrationProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" className={className} {...base}>
      <rect x="22" y="18" width="52" height="64" rx="6" />
      <rect x="36" y="12" width="24" height="12" rx="3" />
      <path d="M32 40 L38 46 L48 34" />
      <path d="M32 58 h32" />
      <path d="M32 68 h32" />
    </svg>
  );
}
