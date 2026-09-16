"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { TRIP_DURATION_PRESETS } from "@/lib/database.types";

export function TripDurationButtons({ tripId, preferredTripDays }: { tripId: string; preferredTripDays: number }) {
  const router = useRouter();
  const [pending, setPending] = useState<number | null>(null);

  async function setDuration(days: number) {
    if (days === preferredTripDays) return;
    setPending(days);
    await fetch(`/api/trips/${tripId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "set_trip_duration", preferredTripDays: days }),
    });
    setPending(null);
    router.refresh();
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {TRIP_DURATION_PRESETS.map((days) => (
        <button
          key={days}
          disabled={pending !== null}
          onClick={() => setDuration(days)}
          className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-all active:scale-95 disabled:opacity-60 ${
            preferredTripDays === days ? "bg-ink text-paper" : "border border-line text-ink-2"
          }`}
        >
          {pending === days ? "Saving…" : `${days} days`}
        </button>
      ))}
    </div>
  );
}
