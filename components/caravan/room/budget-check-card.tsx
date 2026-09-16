"use client";
import { useState } from "react";
import { Loader2 } from "lucide-react";

type Answer = "yes" | "no";

// Interactive content inside a thread message bubble — a new pattern for
// this codebase (every other agent message is plain text). Kept local and
// self-contained rather than threading state up through ThreadFeed: once
// answered, this card is done, nothing else on the page needs to react to it.
export function BudgetCheckCard({
  tripId,
  budgetCheckId,
  thresholdAmount,
  initialStatus,
}: {
  tripId: string;
  budgetCheckId: string;
  thresholdAmount: number;
  initialStatus: "pending" | "yes" | "no";
}) {
  const [status, setStatus] = useState<"pending" | "yes" | "no">(initialStatus);
  const [showReasonInput, setShowReasonInput] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState<Answer | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function answer(body: { answer: "yes" } | { answer: "no"; reason: string }) {
    setPending(body.answer);
    setError(null);
    try {
      const res = await fetch(`/api/trips/${tripId}/budget-check/${budgetCheckId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("failed");
      setStatus(body.answer);
    } catch {
      setError("Couldn't save that — try again.");
    } finally {
      setPending(null);
    }
  }

  if (status === "yes") {
    return <p className="mt-1.5 text-xs font-medium text-signal-d">✓ You said you could stretch to ₹{thresholdAmount.toLocaleString("en-IN")}.</p>;
  }
  if (status === "no") {
    return <p className="mt-1.5 text-xs font-medium text-ink-3">✓ You said that&rsquo;s a hard limit — the admin&rsquo;s been told.</p>;
  }

  if (showReasonInput) {
    return (
      <div className="mt-2 flex flex-col gap-1.5">
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Why not — this goes to the group"
          rows={2}
          className="w-full resize-none rounded-lg border border-line bg-paper px-2.5 py-2 text-sm outline-none focus:border-plum"
        />
        {error && <p className="text-xs text-stop">{error}</p>}
        <div className="flex gap-2">
          <button
            onClick={() => setShowReasonInput(false)}
            className="rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-ink-2"
          >
            Back
          </button>
          <button
            disabled={!reason.trim() || pending !== null}
            onClick={() => answer({ answer: "no", reason: reason.trim() })}
            className="flex items-center gap-1.5 rounded-full bg-stop px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
          >
            {pending === "no" && <Loader2 className="size-3 animate-spin" />}
            Send to group
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-2 flex flex-col gap-1.5">
      {error && <p className="text-xs text-stop">{error}</p>}
      <div className="flex gap-2">
        <button
          disabled={pending !== null}
          onClick={() => answer({ answer: "yes" })}
          className="flex items-center gap-1.5 rounded-full bg-agent px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
        >
          {pending === "yes" && <Loader2 className="size-3 animate-spin" />}
          Yes, I can stretch
        </button>
        <button
          disabled={pending !== null}
          onClick={() => setShowReasonInput(true)}
          className="rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-ink-2 disabled:opacity-40"
        >
          No, hard limit
        </button>
      </div>
    </div>
  );
}
