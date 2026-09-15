"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AppBar } from "@/components/caravan/layout/app-bar";
import { ProgressDots } from "@/components/caravan/primitives/progress-dots";
import { Chip } from "@/components/caravan/primitives/chip";
import { BudgetSlider } from "@/components/caravan/intake/budget-slider";
import { writeDraft, readDraft } from "@/app/trips/new/new-trip-store";
import { FlowShell } from "@/components/caravan/primitives/flow-shell";

const VIBE_OPTIONS = ["Beach", "Mountains", "Party", "Slow", "Road trip", "Food", "Trekking", "Cities"];

function parseBudgetHint(hint: string): number {
  const digits = hint.replace(/[^\d]/g, "");
  const n = Number(digits);
  return n >= 5000 && n <= 200000 ? n : 15000;
}
const TONES = [
  { value: "efficient" as const, label: "Efficient", desc: "Short. No jokes. Gets to the point." },
  { value: "warm" as const, label: "Warm", desc: "Friendly, a little chatty." },
  { value: "dry" as const, label: "Dry", desc: "Funny, slightly mouthy." },
];

export default function NewTripVibePage() {
  const router = useRouter();
  const draft = readDraft();
  const [vibe, setVibe] = useState<string[]>(draft.vibe);
  const [budgetAmount, setBudgetAmount] = useState(draft.budgetHint ? parseBudgetHint(draft.budgetHint) : 15000);
  const [agentTone, setAgentTone] = useState(draft.agentTone);

  function toggleVibe(v: string) {
    setVibe((cur) => (cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]));
  }

  function next() {
    writeDraft({ vibe, budgetHint: `₹${budgetAmount.toLocaleString("en-IN")}`, agentTone });
    router.push(`/trips/new/invite`);
  }

  return (
    <FlowShell>
      <AppBar title="New trip" right="2 of 3" />
      <div className="flex-1 flex flex-col gap-3 px-5 md:px-8 overflow-y-auto">
        <ProgressDots step={1} total={3} />
        <h1 className="font-display text-2xl font-semibold">Set the starting vibe</h1>
        <p className="text-sm text-ink-2">
          A starting point, not a decision. The group can push back the moment the trip opens.
        </p>
        <div className="flex flex-wrap gap-1.5">
          {VIBE_OPTIONS.map((v) => (
            <Chip key={v} selected={vibe.includes(v)} onClick={() => toggleVibe(v)}>
              {v}
            </Chip>
          ))}
        </div>
        <label className="text-xs font-medium text-ink-2 mt-1.5">Rough budget a head</label>
        <BudgetSlider value={budgetAmount} onChange={setBudgetAmount} />
        <label className="text-xs font-medium text-ink-2 mt-1.5">How should the agent talk?</label>
        <div className="flex flex-col gap-2">
          {TONES.map((t) => (
            <button
              key={t.value}
              onClick={() => setAgentTone(t.value)}
              className={`text-left p-3.5 rounded-lg flex items-center gap-3 ${
                agentTone === t.value ? "border-[1.5px] border-plum bg-plum-t" : "border border-line"
              }`}
            >
              <div className="flex-1">
                <div className="text-sm font-semibold">{t.label}</div>
                <div className="text-xs text-ink-3">{t.desc}</div>
              </div>
              <div
                className={`size-[18px] rounded-full border-[1.5px] ${
                  agentTone === t.value ? "bg-plum border-plum" : "border-line"
                }`}
              />
            </button>
          ))}
        </div>
      </div>
      <div className="px-5 pb-10 pt-4 md:px-8">
        <button onClick={next} className="w-full py-4 rounded-xl bg-plum text-white font-semibold">
          Next
        </button>
      </div>
    </FlowShell>
  );
}
