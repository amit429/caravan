"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { useConfirm } from "@/components/caravan/shared/use-confirm";
import { EmptyState } from "@/components/caravan/primitives/empty-state";
import { BookmarkIllustration } from "@/components/caravan/primitives/illustrations";
import type { IdeaRow, IdeaVoteRow } from "@/lib/database.types";

export function IdeaInbox({
  tripId,
  ideas,
  votes,
  myMemberId,
  isAdmin = false,
}: {
  tripId: string;
  ideas: IdeaRow[];
  votes: IdeaVoteRow[];
  myMemberId: string;
  isAdmin?: boolean;
}) {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { confirm, dialog } = useConfirm();

  const countsByIdea = new Map<string, number>();
  const votedByMe = new Set<string>();
  for (const v of votes) {
    countsByIdea.set(v.idea_id, (countsByIdea.get(v.idea_id) ?? 0) + 1);
    if (v.member_id === myMemberId) votedByMe.add(v.idea_id);
  }

  async function submit() {
    if (!url.trim()) return;
    setPending(true);
    setError(null);
    const res = await fetch(`/api/trips/${tripId}/ideas`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: url.trim() }),
    });
    setPending(false);
    if (!res.ok) {
      setError("Couldn't file that link — check it's a valid URL.");
      return;
    }
    setUrl("");
    router.refresh();
  }

  async function vote(ideaId: string) {
    await fetch(`/api/trips/${tripId}/ideas/${ideaId}/vote`, { method: "POST" });
    router.refresh();
  }

  async function remove(ideaId: string) {
    if (!(await confirm("Delete this idea?", undefined, { destructive: true }))) return;
    await fetch(`/api/trips/${tripId}/ideas/${ideaId}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      {dialog}
      <div className="flex gap-2">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Paste a link to a place or activity…"
          className="flex-1 rounded-lg border border-line bg-card px-3 py-2 text-sm outline-none focus:border-plum"
        />
        <button
          disabled={pending}
          onClick={submit}
          className="shrink-0 rounded-lg bg-plum px-3.5 py-2 text-sm font-semibold text-white disabled:opacity-40"
        >
          {pending ? "Filing…" : "Add"}
        </button>
      </div>
      {error && <p className="text-xs text-stop">{error}</p>}
      {ideas.length === 0 ? (
        <EmptyState
          icon={<BookmarkIllustration size={88} />}
          title="No ideas yet"
          body="Paste a link to a place or activity above — Instagram, YouTube, a blog, anything — and it'll turn into a card here."
        />
      ) : (
        <div className="flex flex-col gap-2">
          {ideas.map((idea) => (
            <div key={idea.id} className="flex gap-3 rounded-lg border border-line bg-card p-3">
              {idea.image_url && (
                // eslint-disable-next-line @next/next/no-img-element -- arbitrary scraped host, not configurable via next/image remotePatterns
                <img src={idea.image_url} alt="" className="h-14 w-14 shrink-0 rounded-md object-cover" />
              )}
              <div className="min-w-0 flex-1">
                <a href={idea.url} target="_blank" rel="noreferrer" className="text-sm font-semibold hover:underline">
                  {idea.title ?? idea.url}
                </a>
                {idea.note && <p className="text-xs text-ink-2">{idea.note}</p>}
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1.5">
                <button
                  onClick={() => vote(idea.id)}
                  className={`h-fit rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors ${
                    votedByMe.has(idea.id) ? "border-plum bg-plum text-white" : "border-line text-ink-2"
                  }`}
                >
                  &#9650; {countsByIdea.get(idea.id) ?? 0}
                </button>
                {(idea.member_id === myMemberId || isAdmin) && (
                  <button
                    onClick={() => remove(idea.id)}
                    aria-label="Delete idea"
                    className="text-ink-3 transition-colors hover:text-stop"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
