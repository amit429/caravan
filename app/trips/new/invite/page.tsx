"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AppBar } from "@/components/caravan/app-bar";
import { ProgressDots } from "@/components/caravan/progress-dots";
import { Card } from "@/components/caravan/card";
import { readDraft, clearDraft } from "@/app/trips/new/new-trip-store";
import type { TripRow } from "@/lib/database.types";

export default function NewTripInvitePage() {
  const router = useRouter();
  const [trip, setTrip] = useState<TripRow | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const draft = readDraft();
    fetch("/api/trips", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error("could not create trip");
        const { trip } = await res.json();
        setTrip(trip);
        clearDraft();
      })
      .catch(() => setError("Something went wrong creating the trip."));
  }, []);

  if (error) return <main className="p-5 text-stop">{error}</main>;
  if (!trip) return <main className="p-5 text-ink-2">Creating your trip&hellip;</main>;

  const link = `${window.location.origin}/join/${trip.invite_code}`;

  return (
    <main className="min-h-screen flex flex-col max-w-md mx-auto">
      <AppBar title="New trip" right="3 of 3" />
      <div className="flex-1 flex flex-col gap-4 px-5">
        <ProgressDots step={2} total={3} />
        <h1 className="font-display text-2xl font-semibold">Send them the code</h1>
        <p className="text-sm text-ink-2">No app, no signup. They open the link, type a name, and they are in.</p>
        <div className="bg-ink text-paper text-center rounded-lg py-6 px-4">
          <div className="font-mono text-[10.5px] text-signal">ROOM CODE</div>
          <div className="font-mono text-[38px] font-medium tracking-widest my-1.5">{trip.invite_code}</div>
          <div className="font-mono text-[11.5px] opacity-60">{link}</div>
        </div>
        <div className="flex gap-2.5">
          <button
            onClick={() => navigator.clipboard.writeText(link)}
            className="flex-1 py-3.5 rounded-xl border border-line font-semibold"
          >
            Copy link
          </button>
        </div>
        <Card variant="flat">
          <p className="text-sm">
            The room stays shut until you open it, so nobody trickles in over four days. Everyone
            starts at the same moment.
          </p>
        </Card>
      </div>
      <div className="px-5 pb-10 pt-4">
        <button
          onClick={() => router.push(`/trips/${trip.id}/lobby`)}
          className="w-full py-4 rounded-xl bg-plum text-white font-semibold"
        >
          Go to the lobby
        </button>
      </div>
    </main>
  );
}
