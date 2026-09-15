"use client";
import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { FlowShell } from "@/components/caravan/primitives/flow-shell";
import { AppBar } from "@/components/caravan/layout/app-bar";
import { ProgressDots } from "@/components/caravan/primitives/progress-dots";
import { Chip } from "@/components/caravan/primitives/chip";
import { BudgetSlider } from "@/components/caravan/intake/budget-slider";
import { AvailabilityCalendar } from "@/components/caravan/intake/availability-calendar";
import { AmbientGlow } from "@/components/caravan/primitives/ambient-glow";
import {
  SunCalendarIllustration,
  WalletIllustration,
  SignpostIllustration,
  SunWaveIllustration,
  ShieldIllustration,
  PartyPopperIllustration,
} from "@/components/caravan/primitives/illustrations";
import { coalesceAvailability, type Strength } from "@/lib/dates/availability-calendar";
import { VIBE_EMOJI } from "@/lib/facts/vibe-emoji";

const VIBE_OPTIONS = ["Beach", "Mountains", "Party", "Slow", "Road trip", "Food", "Trekking", "Cities"];
const HARD_NO_SUGGESTIONS = ["No flights", "No overnight buses", "No trekking", "Back by Sunday night"];
const STEP_COUNT = 5; // availability, budget, departure city, vibe, hard nos

const STEP_META = [
  { Icon: SunCalendarIllustration, tint: "bg-signal-d/15 text-signal-d", eyebrow: "When" },
  { Icon: WalletIllustration, tint: "bg-agent-t text-agent", eyebrow: "Budget" },
  { Icon: SignpostIllustration, tint: "bg-plum-t text-plum", eyebrow: "From" },
  { Icon: SunWaveIllustration, tint: "bg-warn-t text-warn", eyebrow: "Vibe" },
  { Icon: ShieldIllustration, tint: "bg-stop-t text-stop", eyebrow: "Hard nos" },
];

export default function IntakePage() {
  const { tripId } = useParams<{ tripId: string }>();
  const router = useRouter();

  const [step, setStep] = useState(0);
  const [availabilityMarks, setAvailabilityMarks] = useState<Record<string, Strength>>({});
  const [budgetAmount, setBudgetAmount] = useState(15000);
  const [departureCity, setDepartureCity] = useState("");
  const [vibe, setVibe] = useState<string[]>([]);
  const [hardNoText, setHardNoText] = useState("");
  const [hardNos, setHardNos] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function toggleVibe(v: string) {
    setVibe((cur) => (cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]));
  }

  function addHardNo(text?: string) {
    const trimmed = (text ?? hardNoText).trim();
    if (!trimmed || hardNos.includes(trimmed)) return;
    setHardNos((cur) => [...cur, trimmed]);
    setHardNoText("");
  }

  function removeHardNo(index: number) {
    setHardNos((cur) => cur.filter((_, i) => i !== index));
  }

  async function submit() {
    setSubmitting(true);
    setError(null);
    const res = await fetch(`/api/trips/${tripId}/intake`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        availability: coalesceAvailability(availabilityMarks),
        budgetAmount,
        departureCity,
        vibe,
        hardNos,
      }),
    });
    setSubmitting(false);
    if (!res.ok) {
      setError("Something went wrong saving your answers. Try again.");
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <FlowShell className="relative overflow-hidden justify-center items-center gap-4 px-8 text-center">
        <AmbientGlow />
        <div className="relative grid size-20 place-items-center rounded-full bg-signal-d/15 text-signal-d animate-in zoom-in-50 fade-in duration-500">
          <PartyPopperIllustration size={44} />
        </div>
        <h1 className="relative font-display text-2xl font-semibold">You&rsquo;re in</h1>
        <p className="relative text-sm text-ink-2">
          The agent will work out which dates actually work once everyone&rsquo;s answered.
        </p>
        <button
          onClick={() => router.push(`/trip/${tripId}/room`)}
          className="relative w-full py-4 rounded-xl bg-plum text-white font-semibold transition-transform active:scale-[0.98]"
        >
          Back to the room
        </button>
      </FlowShell>
    );
  }

  const canGoNext =
    (step === 0 && Object.keys(availabilityMarks).length > 0) ||
    step === 1 ||
    (step === 2 && departureCity.trim()) ||
    step === 3 ||
    step === 4;

  const meta = STEP_META[step];
  const Icon = meta.Icon;

  return (
    <FlowShell>
      <AppBar title="Quick questions" right={`${step + 1} of ${STEP_COUNT}`} />
      <div className="flex-1 flex flex-col gap-4 px-5 md:px-8 overflow-y-auto">
        <ProgressDots step={step} total={STEP_COUNT} />

        <div key={step} className="flex flex-col gap-4 animate-in fade-in slide-in-from-right-3 duration-300">
          <div className="flex items-center gap-3">
            <div className={`grid size-14 shrink-0 place-items-center rounded-full ${meta.tint}`}>
              <Icon size={30} />
            </div>
            <span className="font-mono text-[10.5px] uppercase tracking-wide text-ink-3">
              Step {step + 1} of {STEP_COUNT} &middot; {meta.eyebrow}
            </span>
          </div>

          {step === 0 && (
            <>
              <h1 className="font-display text-2xl font-semibold">When could you go?</h1>
              <p className="text-sm text-ink-2">
                Drag across the days. Tap once for free, tap again for &ldquo;could work but it&rsquo;s tight&rdquo;, again for can&rsquo;t.
              </p>
              <AvailabilityCalendar marks={availabilityMarks} onChange={setAvailabilityMarks} />
            </>
          )}

          {step === 1 && (
            <>
              <h1 className="font-display text-2xl font-semibold">What&rsquo;s your budget?</h1>
              <div className="rounded-lg border-l-[3px] border-agent bg-agent-t/50 p-3.5">
                <p className="text-sm">
                  <span className="font-semibold">Nobody sees this number.</span> Not even the admin &mdash; the group
                  only ever sees a ceiling the whole plan has to fit under.
                </p>
              </div>
              <BudgetSlider value={budgetAmount} onChange={setBudgetAmount} />
            </>
          )}

          {step === 2 && (
            <>
              <h1 className="font-display text-2xl font-semibold">Where are you leaving from?</h1>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-ink-2">Departure city</label>
                <input
                  value={departureCity}
                  onChange={(e) => setDepartureCity(e.target.value)}
                  placeholder="Pune"
                  className="bg-card border border-line rounded-md p-3.5 transition-colors focus:border-plum focus:outline-none"
                />
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <h1 className="font-display text-2xl font-semibold">What&rsquo;s the vibe?</h1>
              <p className="text-sm text-ink-2">Pick as many as you want.</p>
              <div className="flex flex-wrap gap-1.5">
                {VIBE_OPTIONS.map((v) => (
                  <Chip key={v} selected={vibe.includes(v)} onClick={() => toggleVibe(v)}>
                    {VIBE_EMOJI[v]} {v}
                  </Chip>
                ))}
              </div>
            </>
          )}

          {step === 4 && (
            <>
              <h1 className="font-display text-2xl font-semibold">Any hard nos?</h1>
              <p className="text-sm text-ink-2">
                Things that rule an option out entirely &mdash; these can never be voted away.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {HARD_NO_SUGGESTIONS.filter((s) => !hardNos.includes(s)).map((s) => (
                  <Chip key={s} onClick={() => addHardNo(s)}>
                    + {s}
                  </Chip>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  value={hardNoText}
                  onChange={(e) => setHardNoText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addHardNo()}
                  placeholder="Something else…"
                  className="flex-1 bg-card border border-line rounded-md p-3.5 transition-colors focus:border-plum focus:outline-none"
                />
                <button onClick={() => addHardNo()} className="px-4 rounded-md border border-line font-semibold transition-colors active:bg-sunk">
                  Add
                </button>
              </div>
              {hardNos.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {hardNos.map((h, i) => (
                    <Chip key={i} selected onClick={() => removeHardNo(i)}>
                      {h} &times;
                    </Chip>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {error && <p className="text-xs text-stop">{error}</p>}
      </div>
      <div className="px-5 pb-10 pt-4 md:px-8 flex gap-2.5">
        {step > 0 && (
          <button
            onClick={() => setStep((s) => s - 1)}
            className="flex-1 py-4 rounded-xl border border-line font-semibold transition-colors active:bg-sunk"
          >
            Back
          </button>
        )}
        <button
          disabled={!canGoNext || submitting}
          onClick={() => (step === STEP_COUNT - 1 ? submit() : setStep((s) => s + 1))}
          className="flex-1 py-4 rounded-xl bg-plum text-white font-semibold disabled:opacity-40 transition-transform active:scale-[0.98]"
        >
          {step === STEP_COUNT - 1 ? (submitting ? "Saving…" : "Done") : "Next"}
        </button>
      </div>
    </FlowShell>
  );
}
