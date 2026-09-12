"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { IdeaRow, IdeaVoteRow } from "@/lib/database.types";

export function IdeaInbox({
  tripId,
  ideas,
  votes,
  myMemberId,
}: {
  tripId: string;
  ideas: IdeaRow[];
  votes: IdeaVoteRow[];
  myMemberId: string;
}) {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <div className="flex flex-col gap-3">
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
        <p className="text-sm text-ink-2">No ideas yet — paste a link to a place or activity.</p>
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
              <button
                onClick={() => vote(idea.id)}
                className={`h-fit shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${
                  votedByMe.has(idea.id) ? "border-plum bg-plum text-white" : "border-line text-ink-2"
                }`}
              >
                &#9650; {countsByIdea.get(idea.id) ?? 0}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
