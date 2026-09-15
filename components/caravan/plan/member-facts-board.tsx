"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { BottomSheet } from "@/components/caravan/primitives/bottom-sheet";
import { Avatar } from "@/components/caravan/primitives/avatar";
import { FACT_CATEGORY_LABEL, formatFactValue } from "@/lib/facts/format-fact";
import { vibeEmoji } from "@/lib/facts/vibe-emoji";
import type { FactRow, MemberRow } from "@/lib/database.types";

const SOURCE_LABEL: Record<FactRow["source"], string> = {
  intake: "from the five questions",
  extract: "read from a message",
  manual: "added manually",
};

function categoryChipClass(category: FactRow["category"]) {
  if (category === "hard_no") return "bg-stop-t text-stop";
  if (category === "vibe") return "bg-plum-t text-plum";
  return "bg-sunk text-ink-2";
}

function categoryEmoji(fact: FactRow) {
  if (fact.category === "departure_city") return "📍";
  if (fact.category === "hard_no") return "🚫";
  if (fact.category === "vibe") {
    const tags = (fact.value as { tags?: string[] }).tags;
    return tags && tags.length === 1 ? vibeEmoji(tags[0]) : "✨";
  }
  return "";
}

// Plan links here instead of showing one flat cross-member list (the old
// layout, undifferentiated rows for a 6-person group, read as noise) —
// grouped by person, each category rendered as its own set of colorful
// chips, and a category simply doesn't appear for someone who has nothing
// filed in it (no "Hard nos: none" placeholder rows).
export function MemberFactsBoard({
  tripId,
  members,
  facts,
  myMemberId,
}: {
  tripId: string;
  members: MemberRow[];
  facts: FactRow[];
  myMemberId: string;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<FactRow | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [pending, setPending] = useState(false);

  const factsByMember = new Map<string, FactRow[]>();
  for (const f of facts) {
    const list = factsByMember.get(f.member_id) ?? [];
    list.push(f);
    factsByMember.set(f.member_id, list);
  }

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
    setPending(true);
    await fetch(`/api/trips/${tripId}/facts/${selected.id}`, { method: "DELETE" });
    setPending(false);
    setConfirmingDelete(false);
    setSelected(null);
    router.refresh();
  }

  function closeSheet() {
    setSelected(null);
    setConfirmingDelete(false);
  }

  const isMine = selected?.member_id === myMemberId;

  return (
    <>
      <div className="flex flex-col gap-3">
        {members.map((m, i) => {
          const memberFacts = factsByMember.get(m.id) ?? [];
          return (
            <div key={m.id} className="flex flex-col gap-3 rounded-lg bg-card p-4">
              <div className="flex items-center gap-2.5">
                <Avatar name={m.display_name} colorIndex={i} />
                <span className="font-display text-base font-semibold">{m.display_name}</span>
              </div>
              {memberFacts.length === 0 ? (
                <p className="text-xs text-ink-3">Hasn&rsquo;t answered yet.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {memberFacts.map((f) => (
                    <button
                      key={f.id}
                      onClick={() => setSelected(f)}
                      className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-transform active:scale-95 ${categoryChipClass(f.category)}`}
                    >
                      <span>{categoryEmoji(f)}</span>
                      {formatFactValue(f.value)}
                      {f.type === "HARD" && <span className="font-semibold">HARD</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <BottomSheet open={!!selected} onClose={closeSheet}>
        {selected && confirmingDelete ? (
          <div className="flex flex-col gap-3">
            <h2 className="font-display text-lg font-semibold">Delete this fact?</h2>
            <p className="text-sm text-ink-2">&ldquo;{formatFactValue(selected.value)}&rdquo; will be gone for good.</p>
            <div className="flex gap-2.5 pt-1">
              <button
                onClick={() => setConfirmingDelete(false)}
                className="flex-1 rounded-xl border border-line py-3.5 font-semibold"
              >
                Cancel
              </button>
              <button disabled={pending} onClick={remove} className="flex-1 rounded-xl bg-stop py-3.5 font-semibold text-white disabled:opacity-40">
                Delete
              </button>
            </div>
          </div>
        ) : (
          selected && (
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
                {members.find((m) => m.id === selected.member_id)?.display_name ?? "Someone"},{" "}
                {FACT_CATEGORY_LABEL[selected.category].toLowerCase()}
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
                    onClick={() => setConfirmingDelete(true)}
                    className="flex items-center justify-between py-2.5 text-sm font-medium text-stop disabled:opacity-40"
                  >
                    This is wrong, delete it
                    <span className="text-ink-3">&rsaquo;</span>
                  </button>
                </div>
              ) : (
                <p className="pt-1 text-xs text-ink-3">
                  Only {members.find((m) => m.id === selected.member_id)?.display_name ?? "they"} can change this.
                </p>
              )}
            </div>
          )
        )}
      </BottomSheet>
    </>
  );
}
