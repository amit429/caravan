"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import type { IdeaRow, IdeaVoteRow } from "@/lib/database.types";

// Stay/travel suggestions Scribe pulled straight out of chat (a hotel link,
// "let's take the 6am flight") land here instead of the generic Ideas list —
// this is what makes an auto-detected link actually useful: one admin tap
// turns it into a real tracked booking below, instead of it just sitting in
// a pile nobody revisits.
export function SuggestedIdeas({
  tripId,
  title,
  ideas: initialIdeas,
  votes: initialVotes,
  myMemberId,
  isAdmin,
}: {
  tripId: string;
  title: string;
  ideas: IdeaRow[];
  votes: IdeaVoteRow[];
  myMemberId: string;
  isAdmin: boolean;
}) {
  const router = useRouter();

  const [votes, setVotes] = useState<IdeaVoteRow[]>(initialVotes);
  const [syncedFrom, setSyncedFrom] = useState(initialVotes);
  if (initialVotes !== syncedFrom) {
    setSyncedFrom(initialVotes);
    setVotes(initialVotes);
  }
  const [pendingIdeaIds, setPendingIdeaIds] = useState<Set<string>>(new Set());
  const [promotingId, setPromotingId] = useState<string | null>(null);

  if (initialIdeas.length === 0) return null;

  const countsByIdea = new Map<string, number>();
  const votedByMe = new Set<string>();
  for (const v of votes) {
    countsByIdea.set(v.idea_id, (countsByIdea.get(v.idea_id) ?? 0) + 1);
    if (v.member_id === myMemberId) votedByMe.add(v.idea_id);
  }

  async function vote(ideaId: string) {
    if (pendingIdeaIds.has(ideaId)) return;
    const wasVoted = votedByMe.has(ideaId);
    const previousVotes = votes;
    const optimisticVotes = wasVoted
      ? votes.filter((v) => !(v.idea_id === ideaId && v.member_id === myMemberId))
      : [...votes, { id: `optimistic-${ideaId}`, idea_id: ideaId, member_id: myMemberId, created_at: new Date().toISOString() }];

    setVotes(optimisticVotes);
    setPendingIdeaIds((cur) => new Set(cur).add(ideaId));
    try {
      const res = await fetch(`/api/trips/${tripId}/ideas/${ideaId}/vote`, { method: "POST" });
      if (!res.ok) throw new Error("vote request failed");
    } catch {
      setVotes(previousVotes);
    } finally {
      setPendingIdeaIds((cur) => {
        const next = new Set(cur);
        next.delete(ideaId);
        return next;
      });
    }
  }

  async function promote(ideaId: string) {
    setPromotingId(ideaId);
    await fetch(`/api/trips/${tripId}/ideas/${ideaId}/promote`, { method: "POST" });
    setPromotingId(null);
    router.refresh();
  }

  return (
    <section className="flex flex-col gap-2">
      <h3 className="font-mono text-xs text-ink-3">{title}</h3>
      <div className="flex flex-col gap-2">
        {initialIdeas.map((idea) => {
          const isVotePending = pendingIdeaIds.has(idea.id);
          const isPromoting = promotingId === idea.id;
          return (
            <div key={idea.id} className="flex gap-3 rounded-lg border border-line bg-card p-3">
              {idea.image_url && (
                // eslint-disable-next-line @next/next/no-img-element -- arbitrary scraped host, not configurable via next/image remotePatterns
                <img src={idea.image_url} alt="" className="h-14 w-14 shrink-0 rounded-md object-cover" />
              )}
              <div className="min-w-0 flex-1">
                {idea.url ? (
                  <a href={idea.url} target="_blank" rel="noreferrer" className="text-sm font-semibold hover:underline">
                    {idea.title ?? idea.url}
                  </a>
                ) : (
                  <span className="text-sm font-semibold">{idea.title}</span>
                )}
                {idea.note && <p className="text-xs text-ink-2">{idea.note}</p>}
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1.5">
                <button
                  disabled={isVotePending}
                  onClick={() => vote(idea.id)}
                  className={`flex h-fit items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold transition-all disabled:cursor-not-allowed ${
                    votedByMe.has(idea.id) ? "border-plum bg-plum text-white" : "border-line text-ink-2"
                  } ${isVotePending ? "opacity-70" : "active:scale-95"}`}
                >
                  {isVotePending ? <Loader2 className="size-3 animate-spin" /> : <>&#9650;</>} {countsByIdea.get(idea.id) ?? 0}
                </button>
                {isAdmin && (
                  <button
                    disabled={isPromoting}
                    onClick={() => promote(idea.id)}
                    className="text-[11px] font-semibold text-plum disabled:opacity-40"
                  >
                    {isPromoting ? "Tracking…" : "Track this"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
