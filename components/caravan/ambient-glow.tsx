// Soft, slow-drifting blobs of color behind a hero section — the one bit of
// "fun" allowed to move on its own, everywhere else in the app is static.
// Purely decorative: pointer-events-none, and motion-safe: so it just sits
// still for anyone with prefers-reduced-motion set.
export function AmbientGlow() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <div className="motion-safe:animate-[drift_9s_ease-in-out_infinite] absolute -left-10 -top-14 size-40 rounded-full bg-signal/25 blur-3xl" />
      <div className="motion-safe:animate-[drift_11s_ease-in-out_infinite_1s] absolute -right-8 top-4 size-36 rounded-full bg-agent/20 blur-3xl" />
      <div className="motion-safe:animate-[drift_10s_ease-in-out_infinite_0.5s] absolute left-1/3 top-16 size-28 rounded-full bg-plum/15 blur-3xl" />
    </div>
  );
}
