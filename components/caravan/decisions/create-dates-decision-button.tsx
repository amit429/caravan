"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatWindowLabel, type DateWindow } from "@/lib/dates/date-solver";

export function CreateDatesDecisionButton({ tripId, windows }: { tripId: string; windows: DateWindow[] }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function create() {
    setPending(true);
    await fetch(`/api/trips/${tripId}/decisions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "DATES",
        options: windows.map((w, i) => ({
          id: `window-${i}`,
          label: formatWindowLabel(w),
        })),
      }),
    });
    setPending(false);
    router.refresh();
  }

  return (
    <button disabled={pending} onClick={create} className="text-xs font-semibold text-plum">
      Put these to a vote
    </button>
  );
}
