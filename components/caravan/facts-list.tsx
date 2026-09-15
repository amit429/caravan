"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { BottomSheet } from "@/components/caravan/bottom-sheet";
import { Avatar } from "@/components/caravan/avatar";
import { FACT_CATEGORY_LABEL, formatFactValue } from "@/lib/facts/format-fact";
import type { FactRow } from "@/lib/database.types";

const SOURCE_LABEL: Record<FactRow["source"], string> = {
  intake: "from the five questions",
  extract: "read from a message",
  manual: "added manually",
};

export function FactsList({
  tripId,
  facts,
  memberNames,
  myMemberId,
}: {
  tripId: string;
  facts: FactRow[];
  memberNames: Map<string, { name: string; colorIndex: number }>;
  myMemberId: string;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<FactRow | null>(null);
  const [pending, setPending] = useState(false);

  async function soften() {
    if (!selected) return;
    setPending(true);
    await fetch(`/api/trips/${tripId}/facts/${selected.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "SOFT" }),
    });
    setPending(false);
    setSelected(null);
    router.refresh();
  }

  async function remove() {
    if (!selected) return;
    if (!window.confirm("Delete this fact?")) return;
    setPending(true);
    await fetch(`/api/trips/${tripId}/facts/${selected.id}`, { method: "DELETE" });
    setPending(false);
    setSelected(null);
    router.refresh();
  }

  if (facts.length === 0) {
    return <p className="text-sm text-ink-2">Nothing filed yet.</p>;
  }

  const isMine = selected?.member_id === myMemberId;

  return (
    <>
      <div className="divide-y divide-line rounded-lg bg-card">
        {facts.map((f) => {
          const who = memberNames.get(f.member_id);
          return (
            <button
              key={f.id}
              onClick={() => setSelected(f)}
              className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left transition-colors hover:bg-sunk"
            >
              <Avatar name={who?.name ?? "?"} colorIndex={who?.colorIndex ?? 0} size="xs" />
              <div className="min-w-0 flex-1">
                <span className="text-sm font-medium">{formatFactValue(f.value)}</span>
                <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-ink-3">
                  <span>{FACT_CATEGORY_LABEL[f.category]}</span>
                  {f.type === "HARD" && <span className="font-semibold text-stop">HARD</span>}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <BottomSheet open={!!selected} onClose={() => setSelected(null)}>
        {selected && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              {selected.type === "HARD" && (
                <span className="rounded-full bg-stop-t px-2 py-1 text-[10px] font-semibold text-stop">HARD</span>
              )}
              <span className="rounded-full bg-agent-t px-2 py-1 text-[10px] font-semibold text-agent">
                {SOURCE_LABEL[selected.source].toUpperCase()}
              </span>
            </div>
            <h2 className="font-display text-lg font-semibold">{formatFactValue(selected.value)}</h2>
            <p className="text-xs text-ink-3">
              {memberNames.get(selected.member_id)?.name ?? "Someone"}, {FACT_CATEGORY_LABEL[selected.category].toLowerCase()}
            </p>
            {isMine ? (
              <div className="flex flex-col gap-0.5 pt-1">
                {selected.type === "HARD" && (
                  <button
                    disabled={pending}
                    onClick={soften}
                    className="flex items-center justify-between py-2.5 text-sm font-medium disabled:opacity-40"
                  >
                    Make it a soft preference
                    <span className="text-ink-3">&rsaquo;</span>
                  </button>
                )}
                <button
                  disabled={pending}
                  onClick={remove}
                  className="flex items-center justify-between py-2.5 text-sm font-medium text-stop disabled:opacity-40"
                >
                  This is wrong, delete it
                  <span className="text-ink-3">&rsaquo;</span>
                </button>
              </div>
            ) : (
              <p className="pt-1 text-xs text-ink-3">
                Only {memberNames.get(selected.member_id)?.name ?? "they"} can change this.
              </p>
            )}
          </div>
        )}
      </BottomSheet>
    </>
  );
}
