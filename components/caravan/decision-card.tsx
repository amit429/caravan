"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Trash2 } from "lucide-react";
import { DECISION_TYPE_TITLE } from "@/lib/decision-titles";
import { BottomSheet } from "@/components/caravan/bottom-sheet";
import { useConfirm } from "@/components/caravan/use-confirm";
import type { DecisionRow, VoteRow } from "@/lib/database.types";

type Block = { optionId: string; message: string };

// Matches docs/design/screens.html's .dest .img / .img.b / .img.c gradients
// exactly, cycled by option index.
const DEST_GRADIENTS = [
  "bg-gradient-to-br from-plum to-[#8A4A82]",
  "bg-gradient-to-br from-agent to-[#3DA893]",
  "bg-gradient-to-br from-[#B06A1C] to-[#D99A3F]",
];

export function DecisionCard({
  tripId,
  decision,
  votes,
  isAdmin,
  showDetailLink = true,
  redirectOnDeleteTo,
}: {
  tripId: string;
  decision: DecisionRow;
  votes: VoteRow[];
  isAdmin: boolean;
  showDetailLink?: boolean;
  redirectOnDeleteTo?: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [block, setBlock] = useState<Block | null>(null);
  const { confirm, dialog } = useConfirm();

  async function remove() {
    if (
      !(await confirm(
        `Delete this ${DECISION_TYPE_TITLE[decision.type]?.toLowerCase() ?? "decision"}?`,
        decision.state === "LOCKED"
          ? "This is already locked in — deleting it erases the call and every vote behind it. There's no undo."
          : "This erases every vote on it for everyone. There's no undo.",
        { destructive: true }
      ))
    )
      return;
    setPending(true);
    await fetch(`/api/trips/${tripId}/decisions/${decision.id}`, { method: "DELETE" });
    setPending(false);
    if (redirectOnDeleteTo) router.push(redirectOnDeleteTo);
    else router.refresh();
  }

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
      if (body.error === "hard_constraint_blocks_option") {
        setBlock({ optionId, message: body.message ?? "Someone marked this option as a hard no." });
      }
      return;
    }
    setBlock(null);
    router.refresh();
  }

  // F7: the runner-up is whichever non-vetoed option has the most votes,
  // excluding the one that just got blocked — the same "most votes wins"
  // rule the close route already applies, just computed here to name the
  // actual alternative instead of leaving the admin to work it out.
  const runnerUp = block
    ? [...decision.options]
        .filter((o) => o.id !== block.optionId && !vetoed.has(o.id))
        .sort((a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0))[0]
    : null;

  const deleteButton = isAdmin && (
    <button
      disabled={pending}
      onClick={remove}
      aria-label="Delete this decision"
      className="text-ink-3 transition-colors hover:text-stop disabled:opacity-40"
    >
      <Trash2 className="size-4" />
    </button>
  );

  const optionCards = decision.options.map((opt, i) => {
          const count = counts.get(opt.id) ?? 0;
          const isVetoed = vetoed.has(opt.id);
          const isWinner = decision.locked_option === opt.id;
          const actions = decision.state !== "LOCKED" && (
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
          );

          // docs/design/screens.html's .dest card (F4/F8) — the hero
          // treatment only makes sense for destination options, which are
          // the only ones with this much reasoning attached (cost/travel/
          // why-it-fits/who-it-fits-worst). Everything else (DATES, CUSTOM)
          // keeps the compact row below.
          if (decision.type === "DESTINATION" && opt.meta) {
            return (
              <div
                key={opt.id}
                className={`overflow-hidden rounded-lg border bg-card ${isWinner ? "border-signal-d" : "border-line"}`}
              >
                <div className={`flex h-[92px] items-end p-3.5 ${DEST_GRADIENTS[i % DEST_GRADIENTS.length]}`}>
                  <h4 className="font-display text-lg font-bold text-white">{opt.label}</h4>
                  {isWinner && (
                    <span className="ml-auto rounded-full bg-white/90 px-2 py-1 text-[10px] font-semibold text-signal-d">
                      LOCKED
                    </span>
                  )}
                  {isVetoed && !isWinner && (
                    <span className="ml-auto rounded-full bg-white/90 px-2 py-1 text-[10px] font-semibold text-stop">
                      HARD NO
                    </span>
                  )}
                </div>
                <div className="flex gap-3.5 border-b border-line px-3.5 py-2.5">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-mono text-[9.5px] text-ink-3">A HEAD</span>
                    <span className="text-[13px] font-semibold">{opt.meta.costPerHead}</span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="font-mono text-[9.5px] text-ink-3">DOOR TO DOOR</span>
                    <span className="text-[13px] font-semibold">{opt.meta.travelTime}</span>
                  </div>
                  <div className="ml-auto flex flex-col gap-0.5 text-right">
                    <span className="font-mono text-[9.5px] text-ink-3">VOTES</span>
                    <span className="text-[13px] font-semibold">{count}</span>
                  </div>
                </div>
                <div className="flex flex-col gap-1.5 px-3.5 py-2.5">
                  <p className="flex gap-2 text-[12.5px] leading-snug text-ink-2">
                    <b className="w-3 shrink-0 font-bold text-signal-d">+</b>
                    <span>{opt.meta.whyFits}</span>
                  </p>
                  <p className="flex gap-2 text-[12.5px] leading-snug text-ink-2">
                    <b className="w-3 shrink-0 font-bold text-stop">&minus;</b>
                    <span>{opt.meta.whoFitsWorst}</span>
                  </p>
                </div>
                {actions && <div className="flex items-center gap-2.5 border-t border-line px-3.5 py-2.5">{actions}</div>}
              </div>
            );
          }

          return (
            <div key={opt.id} className={`flex flex-col gap-1.5 px-3.5 py-2.5 border-t border-line ${isWinner ? "bg-signal/20" : ""}`}>
              <div className="flex items-center gap-2.5">
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium">{opt.label}</span>
                  {isVetoed && <span className="ml-1.5 text-[10px] font-semibold text-stop">hard no</span>}
                  {isWinner && <span className="ml-1.5 text-[10px] font-semibold text-signal-d">locked</span>}
                </div>
                <span className="text-xs text-ink-3">{count}</span>
                {actions}
              </div>
            </div>
          );
  });

  const blockSheet = (
    <BottomSheet open={!!block} onClose={() => setBlock(null)}>
        {block && (
          <div className="flex flex-col gap-3">
            <span className="w-fit rounded-full bg-stop-t px-2.5 py-1 text-[10px] font-semibold text-stop">
              CAN&rsquo;T LOCK THIS
            </span>
            <h2 className="font-display text-lg font-semibold">
              {decision.options.find((o) => o.id === block.optionId)?.label} won the vote. I&rsquo;m not locking it.
            </h2>
            <p className="text-sm text-ink-2">{block.message}</p>
            <div className="flex flex-col gap-0.5 pt-1">
              {runnerUp && (
                <button
                  disabled={pending}
                  onClick={() => lock(runnerUp.id)}
                  className="flex items-center justify-between py-2.5 text-left text-sm font-medium disabled:opacity-40"
                >
                  <span>
                    Take the runner-up
                    <span className="block text-xs font-normal text-ink-3">
                      {runnerUp.label} — {counts.get(runnerUp.id) ?? 0} votes, no hard no against it
                    </span>
                  </span>
                  <span className="text-ink-3">&rsaquo;</span>
                </button>
              )}
              <button
                disabled={pending}
                onClick={() => lock(block.optionId, true)}
                className="flex items-center justify-between py-2.5 text-left text-sm font-medium text-stop disabled:opacity-40"
              >
                <span>
                  Lock it anyway
                  <span className="block text-xs font-normal text-ink-3">Overrides the hard no. Logged with your name on it.</span>
                </span>
                <span className="text-ink-3">&rsaquo;</span>
              </button>
            </div>
            <p className="text-xs text-ink-3">I haven&rsquo;t named who&rsquo;s blocked, and won&rsquo;t. Their reason stays in their own fact.</p>
          </div>
        )}
    </BottomSheet>
  );

  // Destination options render directly on the page instead of stacked
  // inside a shared bordered/overflow-hidden box — that extra wrapper is
  // what was fighting the page's own scroll region (spec fix: "don't need a
  // box on the page with a scroll inside it, show the destinations
  // directly"). Every other decision type keeps the compact boxed list,
  // which was never the problem.
  if (decision.type === "DESTINATION") {
    return (
      <div className="flex flex-col gap-3">
        {dialog}
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] text-ink-3">{decision.state}</span>
          {decision.deadline && decision.state !== "LOCKED" && (
            <span className="ml-auto text-[10px] font-mono text-warn">
              by {new Date(decision.deadline).toLocaleDateString()}
            </span>
          )}
          {deleteButton && <span className="ml-auto">{deleteButton}</span>}
        </div>
        {optionCards}
        {blockSheet}
      </div>
    );
  }

  return (
    <div className="bg-card rounded-lg border border-line overflow-hidden">
      {dialog}
      <div className="flex items-center gap-2 px-3.5 pt-3">
        <span className="font-mono text-[10px] text-ink-3">{decision.state}</span>
        {decision.deadline && decision.state !== "LOCKED" && (
          <span className="ml-auto text-[10px] font-mono text-warn">
            by {new Date(decision.deadline).toLocaleDateString()}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2 px-3.5 pb-2.5 pt-1">
        <span className="font-display text-base font-semibold">{DECISION_TYPE_TITLE[decision.type] ?? decision.type}</span>
        {showDetailLink && (
          <Link href={`/trip/${tripId}/decisions/${decision.id}`} className="ml-auto text-xs font-medium text-plum">
            Details
          </Link>
        )}
        {deleteButton && <span className={showDetailLink ? "" : "ml-auto"}>{deleteButton}</span>}
      </div>
      <div className="flex flex-col">{optionCards}</div>
      {blockSheet}
    </div>
  );
}
