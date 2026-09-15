"use client";

const PRESETS = [10000, 25000, 50000, 75000, 100000];
const MIN = 5000;
const MAX = 200000;

function formatShort(amount: number) {
  return amount >= 100000 ? `₹${(amount / 100000).toFixed(amount % 100000 === 0 ? 0 : 1)}L` : `₹${amount / 1000}k`;
}

// A single slider (₹5k–₹2L) with one-tap presets instead of a fixed set of
// bands — the old chips topped out at "20-35k" plus an unbounded "Open" that
// couldn't feed a group ceiling at all, so picking it silently broke
// destination generation. A real number always works.
export function BudgetSlider({ value, onChange }: { value: number; onChange: (amount: number) => void }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-lg border border-line bg-card p-4 text-center">
        <span className="font-display text-2xl font-bold">₹{value.toLocaleString("en-IN")}</span>
        <p className="mt-0.5 text-xs text-ink-3">all in, a head</p>
      </div>
      <input
        type="range"
        min={MIN}
        max={MAX}
        step={1000}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-plum"
        aria-label="Budget per head"
      />
      <div className="flex justify-between font-mono text-[10px] text-ink-3">
        <span>{formatShort(MIN)}</span>
        <span>{formatShort(MAX)}</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onChange(p)}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-all duration-150 active:scale-95 ${
              value === p ? "scale-[1.04] border-ink bg-ink text-paper shadow-sm" : "border-line bg-card text-ink-2 hover:border-ink-3"
            }`}
          >
            {formatShort(p)}
          </button>
        ))}
      </div>
    </div>
  );
}
