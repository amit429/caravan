"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AppBar } from "@/components/caravan/app-bar";
import { ProgressDots } from "@/components/caravan/progress-dots";
import { writeDraft, readDraft } from "@/app/trips/new/new-trip-store";
import { FlowShell } from "@/components/caravan/flow-shell";

export default function NewTripBasicsPage() {
  const router = useRouter();
  const [name, setName] = useState(() => readDraft().name);
  const [roughIntent, setRoughIntent] = useState(() => readDraft().roughIntent);

  function next() {
    writeDraft({ name, roughIntent });
    router.push("/trips/new/vibe");
  }

  return (
    <FlowShell>
      <AppBar title="New trip" right="1 of 3" />
      <div className="flex-1 flex flex-col gap-4 px-5 md:px-8">
        <ProgressDots step={0} total={3} />
        <h1 className="font-display text-2xl font-semibold">What are we calling it?</h1>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-ink-2">Trip name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Goa, probably"
            className="bg-card border border-line rounded-md p-3.5"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-ink-2">The rough idea, if you have one</label>
          <input
            value={roughIntent}
            onChange={(e) => setRoughIntent(e.target.value)}
            placeholder="Long weekend, beaches, nothing over-planned"
            className="bg-card border border-line rounded-md p-3.5"
          />
        </div>
      </div>
      <div className="px-5 pb-10 pt-4 md:px-8">
        <button
          disabled={!name.trim()}
          onClick={next}
          className="w-full py-4 rounded-xl bg-plum text-white font-semibold disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </FlowShell>
  );
}
