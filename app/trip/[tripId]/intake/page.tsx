"use client";
import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { FlowShell } from "@/components/caravan/flow-shell";
import { AppBar } from "@/components/caravan/app-bar";
import { ProgressDots } from "@/components/caravan/progress-dots";
import { Chip } from "@/components/caravan/chip";

const BUDGET_OPTIONS = ["Under 10k", "10-20k", "20-35k", "Open"];
const VIBE_OPTIONS = ["Beach", "Mountains", "Party", "Slow", "Road trip", "Food", "Trekking", "Cities"];
const STEP_COUNT = 5; // availability, budget, departure city, vibe, hard nos

export default function IntakePage() {
  const { tripId } = useParams<{ tripId: string }>();
  const router = useRouter();

  const [step, setStep] = useState(0);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [budgetBand, setBudgetBand] = useState(BUDGET_OPTIONS[1]);
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

  function addHardNo() {
    const trimmed = hardNoText.trim();
    if (!trimmed) return;
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
        availability: [{ startDate, endDate, strength: "free" }],
        budgetBand,
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
      <FlowShell className="justify-center items-center gap-4 px-8 text-center">
        <h1 className="font-display text-2xl font-semibold">You&rsquo;re in</h1>
        <p className="text-sm text-ink-2">
          The agent will work out which dates actually work once everyone&rsquo;s answered.
        </p>
        <button
          onClick={() => router.push(`/trip/${tripId}/room`)}
          className="w-full py-4 rounded-xl bg-plum text-white font-semibold"
        >
          Back to the room
        </button>
      </FlowShell>
    );
  }

  const canGoNext =
    (step === 0 && startDate && endDate && startDate <= endDate) ||
    (step === 1 && budgetBand) ||
    (step === 2 && departureCity.trim()) ||
    step === 3 ||
    step === 4;

  return (
    <FlowShell>
      <AppBar title="Quick questions" right={`${step + 1} of ${STEP_COUNT}`} />
      <div className="flex-1 flex flex-col gap-4 px-5 md:px-8 overflow-y-auto">
        <ProgressDots step={step} total={STEP_COUNT} />

        {step === 0 && (
          <>
            <h1 className="font-display text-2xl font-semibold">When are you free?</h1>
            <p className="text-sm text-ink-2">Give your widest possible window — the group figures out the overlap.</p>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-ink-2">From</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-card border border-line rounded-md p-3.5"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-ink-2">To</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-card border border-line rounded-md p-3.5"
              />
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <h1 className="font-display text-2xl font-semibold">What&rsquo;s your budget?</h1>
            <p className="text-sm text-ink-2">Only the group ceiling is ever shared — nobody sees your number.</p>
            <div className="flex flex-wrap gap-1.5">
              {BUDGET_OPTIONS.map((b) => (
                <Chip key={b} selected={budgetBand === b} onClick={() => setBudgetBand(b)}>
                  {b}
                </Chip>
              ))}
            </div>
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
                className="bg-card border border-line rounded-md p-3.5"
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
                  {v}
                </Chip>
              ))}
            </div>
          </>
        )}

        {step === 4 && (
          <>
            <h1 className="font-display text-2xl font-semibold">Any hard nos?</h1>
            <p className="text-sm text-ink-2">
              Things that rule an option out entirely — these can never be voted away.
            </p>
            <div className="flex gap-2">
              <input
                value={hardNoText}
                onChange={(e) => setHardNoText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addHardNo()}
                placeholder="No overnight buses"
                className="flex-1 bg-card border border-line rounded-md p-3.5"
              />
              <button onClick={addHardNo} className="px-4 rounded-md border border-line font-semibold">
                Add
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {hardNos.map((h, i) => (
                <Chip key={i} selected onClick={() => removeHardNo(i)}>
                  {h} &times;
                </Chip>
              ))}
            </div>
          </>
        )}

        {error && <p className="text-xs text-stop">{error}</p>}
      </div>
      <div className="px-5 pb-10 pt-4 md:px-8 flex gap-2.5">
        {step > 0 && (
          <button
            onClick={() => setStep((s) => s - 1)}
            className="flex-1 py-4 rounded-xl border border-line font-semibold"
          >
            Back
          </button>
        )}
        <button
          disabled={!canGoNext || submitting}
          onClick={() => (step === STEP_COUNT - 1 ? submit() : setStep((s) => s + 1))}
          className="flex-1 py-4 rounded-xl bg-plum text-white font-semibold disabled:opacity-40"
        >
          {step === STEP_COUNT - 1 ? "Done" : "Next"}
        </button>
      </div>
    </FlowShell>
  );
}
