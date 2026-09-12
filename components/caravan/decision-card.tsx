"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { DecisionRow, VoteRow } from "@/lib/database.types";

const TYPE_TITLE: Record<string, string> = {
  DATES: "When are we going?",
  DESTINATION: "Where are we going?",
  BUDGET: "What's the budget?",
  STAY: "Where are we staying?",
  ACTIVITY: "What are we doing?",
  CUSTOM: "Decision",
};

export function DecisionCard({
  tripId,
  decision,
  votes,
  isAdmin,
}: {
  tripId: string;
  decision: DecisionRow;
  votes: VoteRow[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  const counts = new Map<string, number>();
  const vetoed = new Set<string>();
  for (const v of votes) {
    counts.set(v.option_id, (counts.get(v.option_id) ?? 0) + 1);
    if (v.is_veto) vetoed.add(v.option_id);
  }

  async function vote(optionId: string, isVeto: boolean) {
    setPending(true);
    await fetch(`/api/trips/${tripId}/decisions/${decision.id}/vote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ optionId, isVeto }),
    });
    setPending(false);
    router.refresh();
  }

  async function lock(optionId: string, override = false) {
    setPending(true);
    const res = await fetch(`/api/trips/${tripId}/decisions/${decision.id}/close`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ optionId, override }),
    });
    setPending(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      if (body.error === "hard_constraint_blocks_option" && window.confirm(`${body.message} Lock it anyway?`)) {
        await lock(optionId, true);
      }
      return;
    }
    router.refresh();
  }

  return (
    <div className="bg-card rounded-lg border border-line overflow-hidden">
      <div className="flex items-center gap-2 px-3.5 pt-3">
        <span className="font-mono text-[10px] text-ink-3">{decision.state}</span>
        {decision.deadline && decision.state !== "LOCKED" && (
          <span className="ml-auto text-[10px] font-mono text-warn">
            by {new Date(decision.deadline).toLocaleDateString()}
          </span>
        )}
      </div>
      <div className="px-3.5 pb-2.5 pt-1 font-display text-base font-semibold">
        {TYPE_TITLE[decision.type] ?? decision.type}
      </div>
      <div className="flex flex-col">
        {decision.options.map((opt) => {
          const count = counts.get(opt.id) ?? 0;
          const isVetoed = vetoed.has(opt.id);
          const isWinner = decision.locked_option === opt.id;
          return (
            <div
              key={opt.id}
              className={`flex items-center gap-2.5 px-3.5 py-2.5 border-t border-line ${isWinner ? "bg-signal/20" : ""}`}
            >
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium">{opt.label}</span>
                {isVetoed && <span className="ml-1.5 text-[10px] font-semibold text-stop">hard no</span>}
                {isWinner && <span className="ml-1.5 text-[10px] font-semibold text-signal-d">locked</span>}
              </div>
              <span className="text-xs text-ink-3">{count}</span>
              {decision.state !== "LOCKED" && (
                <>
                  <button
                    disabled={pending}
                    onClick={() => vote(opt.id, false)}
                    className="text-xs font-semibold text-plum px-2.5 py-1.5 rounded-full border border-line"
                  >
                    Vote
                  </button>
                  <button
                    disabled={pending}
                    onClick={() => vote(opt.id, true)}
                    title="This doesn't work for me at all"
                    className="text-xs text-ink-3"
                  >
                    &#128683;
                  </button>
                  {isAdmin && (
                    <button disabled={pending} onClick={() => lock(opt.id)} className="text-xs font-semibold text-ink-2 underline">
                      Lock
                    </button>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
