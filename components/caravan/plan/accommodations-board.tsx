"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2, Lock, LockOpen } from "lucide-react";
import { useConfirm } from "@/components/caravan/shared/use-confirm";
import { EmptyState } from "@/components/caravan/primitives/empty-state";
import { BookmarkIllustration } from "@/components/caravan/primitives/illustrations";
import type { AccommodationRow, AccommodationVoteRow } from "@/lib/database.types";

const UNSORTED = "Unsorted";

export function AccommodationsBoard({
  tripId,
  accommodations,
  votes: initialVotes,
  myMemberId,
  isAdmin,
}: {
  tripId: string;
  accommodations: AccommodationRow[];
  votes: AccommodationVoteRow[];
  myMemberId: string;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const { confirm, dialog } = useConfirm();

  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [price, setPrice] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Same optimistic pattern as IdeaInbox — local vote state seeded from the
  // server prop, flipped instantly, only touched again if the request fails.
  const [votes, setVotes] = useState<AccommodationVoteRow[]>(initialVotes);
  const [syncedFrom, setSyncedFrom] = useState(initialVotes);
  if (initialVotes !== syncedFrom) {
    setSyncedFrom(initialVotes);
    setVotes(initialVotes);
  }
  const [pendingVoteIds, setPendingVoteIds] = useState<Set<string>>(new Set());
  const [voteError, setVoteError] = useState<string | null>(null);

  const countsByAccommodation = new Map<string, number>();
  const votedByMe = new Set<string>();
  for (const v of votes) {
    countsByAccommodation.set(v.accommodation_id, (countsByAccommodation.get(v.accommodation_id) ?? 0) + 1);
    if (v.member_id === myMemberId) votedByMe.add(v.accommodation_id);
  }

  async function addAccommodation() {
    if (!name.trim() || adding) return;
    setAdding(true);
    setAddError(null);
    const res = await fetch(`/api/trips/${tripId}/accommodations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), url: url.trim() || undefined, price: price.trim() || undefined }),
    });
    setAdding(false);
    if (!res.ok) {
      setAddError("Couldn't add that — check the link's a valid URL.");
      return;
    }
    setName("");
    setUrl("");
    setPrice("");
    router.refresh();
  }

  async function vote(accommodationId: string) {
    if (pendingVoteIds.has(accommodationId)) return;
    const wasVoted = votedByMe.has(accommodationId);
    const previousVotes = votes;
    const optimisticVotes = wasVoted
      ? votes.filter((v) => !(v.accommodation_id === accommodationId && v.member_id === myMemberId))
      : [...votes, { id: `optimistic-${accommodationId}`, accommodation_id: accommodationId, member_id: myMemberId, created_at: new Date().toISOString() }];

    setVoteError(null);
    setVotes(optimisticVotes);
    setPendingVoteIds((cur) => new Set(cur).add(accommodationId));
    try {
      const res = await fetch(`/api/trips/${tripId}/accommodations/${accommodationId}/vote`, { method: "POST" });
      if (!res.ok) throw new Error("vote request failed");
    } catch {
      setVotes(previousVotes);
      setVoteError("Couldn't save your vote — try again.");
    } finally {
      setPendingVoteIds((cur) => {
        const next = new Set(cur);
        next.delete(accommodationId);
        return next;
      });
    }
  }

  async function remove(accommodationId: string) {
    if (!(await confirm("Delete this accommodation?", undefined, { destructive: true }))) return;
    await fetch(`/api/trips/${tripId}/accommodations/${accommodationId}`, { method: "DELETE" });
    router.refresh();
  }

  async function setLocked(accommodation: AccommodationRow, locked: boolean, startDate?: string, endDate?: string) {
    await fetch(`/api/trips/${tripId}/accommodations/${accommodation.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locked, startDate, endDate }),
    });
    router.refresh();
  }

  const byArea = new Map<string, AccommodationRow[]>();
  for (const a of accommodations) {
    const area = a.area ?? UNSORTED;
    const list = byArea.get(area) ?? [];
    list.push(a);
    byArea.set(area, list);
  }
  const areas = [...byArea.keys()].sort((a, b) => (a === UNSORTED ? 1 : b === UNSORTED ? -1 : a.localeCompare(b)));

  return (
    <div className="flex flex-col gap-4">
      {dialog}
      <div className="flex flex-col gap-2 rounded-lg bg-card p-3.5">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Hotel or stay name"
          className="rounded-lg border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-plum"
        />
        <div className="flex gap-2">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Link (optional)"
            className="flex-1 rounded-lg border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-plum"
          />
          <input
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="Price (optional)"
            className="w-32 rounded-lg border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-plum"
          />
        </div>
        {addError && <p className="text-xs text-stop">{addError}</p>}
        <button
          disabled={!name.trim() || adding}
          onClick={addAccommodation}
          className="self-start rounded-lg bg-plum px-3.5 py-2 text-sm font-semibold text-white disabled:opacity-40"
        >
          {adding ? "Adding…" : "Add accommodation"}
        </button>
      </div>

      {voteError && <p className="text-xs text-stop">{voteError}</p>}

      {accommodations.length === 0 ? (
        <EmptyState
          icon={<BookmarkIllustration size={88} />}
          title="No accommodations yet"
          body="Drop a hotel link in chat, or add one above — they'll get sorted by area automatically."
        />
      ) : (
        areas.map((area) => (
          <div key={area} className="flex flex-col gap-2">
            <h3 className="font-mono text-xs text-ink-3">{area.toUpperCase()}</h3>
            <div className="flex flex-col gap-2">
              {byArea.get(area)!.map((accommodation) => (
                <AccommodationCard
                  key={accommodation.id}
                  accommodation={accommodation}
                  voteCount={countsByAccommodation.get(accommodation.id) ?? 0}
                  votedByMe={votedByMe.has(accommodation.id)}
                  votePending={pendingVoteIds.has(accommodation.id)}
                  canDelete={accommodation.member_id === myMemberId || isAdmin}
                  isAdmin={isAdmin}
                  onVote={() => vote(accommodation.id)}
                  onDelete={() => remove(accommodation.id)}
                  onSetLocked={(locked, start, end) => setLocked(accommodation, locked, start, end)}
                />
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function AccommodationCard({
  accommodation,
  voteCount,
  votedByMe,
  votePending,
  canDelete,
  isAdmin,
  onVote,
  onDelete,
  onSetLocked,
}: {
  accommodation: AccommodationRow;
  voteCount: number;
  votedByMe: boolean;
  votePending: boolean;
  canDelete: boolean;
  isAdmin: boolean;
  onVote: () => void;
  onDelete: () => void;
  onSetLocked: (locked: boolean, startDate?: string, endDate?: string) => void;
}) {
  const [editingDates, setEditingDates] = useState(false);
  const [startDate, setStartDate] = useState(accommodation.start_date ?? "");
  const [endDate, setEndDate] = useState(accommodation.end_date ?? "");

  return (
    <div className={`flex gap-3 rounded-lg border p-3 ${accommodation.locked ? "border-agent bg-agent-t" : "border-line bg-card"}`}>
      {accommodation.image_url && (
        // eslint-disable-next-line @next/next/no-img-element -- arbitrary scraped host, not configurable via next/image remotePatterns
        <img src={accommodation.image_url} alt="" className="h-14 w-14 shrink-0 rounded-md object-cover" />
      )}
      <div className="min-w-0 flex-1">
        {accommodation.url ? (
          <a href={accommodation.url} target="_blank" rel="noreferrer" className="text-sm font-semibold hover:underline">
            {accommodation.name}
          </a>
        ) : (
          <span className="text-sm font-semibold">{accommodation.name}</span>
        )}
        {accommodation.price && <p className="text-xs text-ink-2">{accommodation.price}</p>}
        {accommodation.locked && accommodation.start_date && accommodation.end_date && (
          <p className="mt-0.5 text-xs font-medium text-agent">
            Locked · {accommodation.start_date} – {accommodation.end_date}
          </p>
        )}
        {isAdmin && editingDates && (
          <div className="mt-2 flex flex-col gap-1.5">
            <div className="flex gap-1.5">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="rounded-md border border-line bg-paper px-2 py-1 text-xs"
              />
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="rounded-md border border-line bg-paper px-2 py-1 text-xs"
              />
            </div>
            <button
              disabled={!startDate || !endDate}
              onClick={() => {
                onSetLocked(true, startDate, endDate);
                setEditingDates(false);
              }}
              className="self-start rounded-md bg-agent px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-40"
            >
              Confirm dates
            </button>
          </div>
        )}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1.5">
        <button
          disabled={votePending}
          onClick={onVote}
          className={`flex h-fit items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold transition-all disabled:cursor-not-allowed ${
            votedByMe ? "border-plum bg-plum text-white" : "border-line text-ink-2"
          } ${votePending ? "opacity-70" : "active:scale-95"}`}
        >
          {votePending ? <Loader2 className="size-3 animate-spin" /> : <>&#9650;</>} {voteCount}
        </button>
        {isAdmin && (
          <button
            onClick={() => (accommodation.locked ? onSetLocked(false) : setEditingDates((cur) => !cur))}
            aria-label={accommodation.locked ? "Unlock" : "Lock"}
            className={accommodation.locked ? "text-agent" : "text-ink-3 transition-colors hover:text-plum"}
          >
            {accommodation.locked ? <Lock className="size-3.5" /> : <LockOpen className="size-3.5" />}
          </button>
        )}
        {canDelete && (
          <button onClick={onDelete} aria-label="Delete accommodation" className="text-ink-3 transition-colors hover:text-stop">
            <Trash2 className="size-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
