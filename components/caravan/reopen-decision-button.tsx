"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function ReopenDecisionButton({ tripId, decisionId }: { tripId: string; decisionId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function reopen() {
    if (!window.confirm("Reopen this decision? The group gets told, and it goes back to a vote.")) return;
    setPending(true);
    await fetch(`/api/trips/${tripId}/decisions/${decisionId}/reopen`, { method: "POST" });
    setPending(false);
    router.refresh();
  }

  return (
    <button
      disabled={pending}
      onClick={reopen}
      className="shrink-0 text-sm font-semibold text-plum transition-opacity disabled:opacity-40"
    >
      Reopen
    </button>
  );
}
