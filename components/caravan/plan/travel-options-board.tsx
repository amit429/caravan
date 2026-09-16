"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2, Lock, LockOpen, Plane, Car, Ship } from "lucide-react";
import { useConfirm } from "@/components/caravan/shared/use-confirm";
import { EmptyState } from "@/components/caravan/primitives/empty-state";
import { BookmarkIllustration } from "@/components/caravan/primitives/illustrations";
import type { MemberRow, TravelMode, TravelOptionMemberRow, TravelOptionRow, TravelOptionVoteRow } from "@/lib/database.types";

const MODE_ORDER: TravelMode[] = ["air", "road", "water"];
const MODE_LABEL: Record<TravelMode, string> = { air: "Air", road: "Road", water: "Water" };
const MODE_ICON: Record<TravelMode, typeof Plane> = { air: Plane, road: Car, water: Ship };

export function TravelOptionsBoard({
  tripId,
  travelOptions,
  votes: initialVotes,
  members: initialMembers,
  activeMembers,
  myMemberId,
  isAdmin,
}: {
  tripId: string;
  travelOptions: TravelOptionRow[];
  votes: TravelOptionVoteRow[];
  members: TravelOptionMemberRow[];
  activeMembers: MemberRow[];
  myMemberId: string;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const { confirm, dialog } = useConfirm();

  const [name, setName] = useState("");
  const [mode, setMode] = useState<TravelMode>("air");
  const [url, setUrl] = useState("");
  const [timing, setTiming] = useState("");
  const [price, setPrice] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const [votes, setVotes] = useState<TravelOptionVoteRow[]>(initialVotes);
  const [syncedVotesFrom, setSyncedVotesFrom] = useState(initialVotes);
  if (initialVotes !== syncedVotesFrom) {
    setSyncedVotesFrom(initialVotes);
    setVotes(initialVotes);
  }
  const [members, setMembers] = useState<TravelOptionMemberRow[]>(initialMembers);
  const [syncedMembersFrom, setSyncedMembersFrom] = useState(initialMembers);
  if (initialMembers !== syncedMembersFrom) {
    setSyncedMembersFrom(initialMembers);
    setMembers(initialMembers);
  }

  const [pendingVoteIds, setPendingVoteIds] = useState<Set<string>>(new Set());
  const [pendingJoinIds, setPendingJoinIds] = useState<Set<string>>(new Set());
  const [actionError, setActionError] = useState<string | null>(null);

  const memberNameById = new Map(activeMembers.map((m) => [m.id, m.display_name]));

  const countsByOption = new Map<string, number>();
  const votedByMe = new Set<string>();
  for (const v of votes) {
    countsByOption.set(v.travel_option_id, (countsByOption.get(v.travel_option_id) ?? 0) + 1);
    if (v.member_id === myMemberId) votedByMe.add(v.travel_option_id);
  }

  const membersByOption = new Map<string, string[]>();
  const joinedByMe = new Set<string>();
  for (const tm of members) {
    const list = membersByOption.get(tm.travel_option_id) ?? [];
    list.push(memberNameById.get(tm.member_id) ?? "Someone");
    membersByOption.set(tm.travel_option_id, list);
    if (tm.member_id === myMemberId) joinedByMe.add(tm.travel_option_id);
  }

  async function addTravelOption() {
    if (!name.trim() || adding) return;
    setAdding(true);
    setAddError(null);
    const res = await fetch(`/api/trips/${tripId}/travel-options`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        mode,
        url: url.trim() || undefined,
        timing: timing.trim() || undefined,
        price: price.trim() || undefined,
      }),
    });
    setAdding(false);
    if (!res.ok) {
      setAddError("Couldn't add that — check the link's a valid URL.");
      return;
    }
    setName("");
    setUrl("");
    setTiming("");
    setPrice("");
    router.refresh();
  }

  async function vote(optionId: string) {
    if (pendingVoteIds.has(optionId)) return;
    const wasVoted = votedByMe.has(optionId);
    const previousVotes = votes;
    const optimisticVotes = wasVoted
      ? votes.filter((v) => !(v.travel_option_id === optionId && v.member_id === myMemberId))
      : [...votes, { id: `optimistic-${optionId}`, travel_option_id: optionId, member_id: myMemberId, created_at: new Date().toISOString() }];

    setActionError(null);
    setVotes(optimisticVotes);
    setPendingVoteIds((cur) => new Set(cur).add(optionId));
    try {
      const res = await fetch(`/api/trips/${tripId}/travel-options/${optionId}/vote`, { method: "POST" });
      if (!res.ok) throw new Error("vote request failed");
    } catch {
      setVotes(previousVotes);
      setActionError("Couldn't save your vote — try again.");
    } finally {
      setPendingVoteIds((cur) => {
        const next = new Set(cur);
        next.delete(optionId);
        return next;
      });
    }
  }

  async function join(optionId: string) {
    if (pendingJoinIds.has(optionId)) return;
    const wasJoined = joinedByMe.has(optionId);
    const previousMembers = members;
    const optimisticMembers = wasJoined
      ? members.filter((m) => !(m.travel_option_id === optionId && m.member_id === myMemberId))
      : [...members, { id: `optimistic-${optionId}`, travel_option_id: optionId, member_id: myMemberId, created_at: new Date().toISOString() }];

    setActionError(null);
    setMembers(optimisticMembers);
    setPendingJoinIds((cur) => new Set(cur).add(optionId));
    try {
      const res = await fetch(`/api/trips/${tripId}/travel-options/${optionId}/join`, { method: "POST" });
      if (!res.ok) throw new Error("join request failed");
    } catch {
      setMembers(previousMembers);
      setActionError("Couldn't save that — try again.");
    } finally {
      setPendingJoinIds((cur) => {
        const next = new Set(cur);
        next.delete(optionId);
        return next;
      });
    }
  }

  async function remove(optionId: string) {
    if (!(await confirm("Delete this travel option?", undefined, { destructive: true }))) return;
    await fetch(`/api/trips/${tripId}/travel-options/${optionId}`, { method: "DELETE" });
    router.refresh();
  }

  async function setLocked(optionId: string, locked: boolean) {
    await fetch(`/api/trips/${tripId}/travel-options/${optionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locked }),
    });
    router.refresh();
  }

  const byMode = new Map<TravelMode, TravelOptionRow[]>();
  for (const t of travelOptions) {
    const list = byMode.get(t.mode) ?? [];
    list.push(t);
    byMode.set(t.mode, list);
  }

  return (
    <div className="flex flex-col gap-4">
      {dialog}
      <div className="flex flex-col gap-2 rounded-lg bg-card p-3.5">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Flight, bus, or car name"
          className="rounded-lg border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-plum"
        />
        <div className="flex gap-1.5">
          {MODE_ORDER.map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`flex-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                mode === m ? "border-plum bg-plum-t text-plum" : "border-line text-ink-2"
              }`}
            >
              {MODE_LABEL[m]}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Link (optional)"
            className="flex-1 rounded-lg border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-plum"
          />
          <input
            value={timing}
            onChange={(e) => setTiming(e.target.value)}
            placeholder="Timing"
            className="w-24 rounded-lg border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-plum"
          />
          <input
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="Price"
            className="w-24 rounded-lg border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-plum"
          />
        </div>
        {addError && <p className="text-xs text-stop">{addError}</p>}
        <button
          disabled={!name.trim() || adding}
          onClick={addTravelOption}
          className="self-start rounded-lg bg-plum px-3.5 py-2 text-sm font-semibold text-white disabled:opacity-40"
        >
          {adding ? "Adding…" : "Add travel option"}
        </button>
      </div>

      {actionError && <p className="text-xs text-stop">{actionError}</p>}

      {travelOptions.length === 0 ? (
        <EmptyState
          icon={<BookmarkIllustration size={88} />}
          title="No travel options yet"
          body="Drop a flight/bus/train link in chat, or add one above — they'll get sorted by mode automatically."
        />
      ) : (
        MODE_ORDER.filter((m) => byMode.has(m)).map((m) => {
          const Icon = MODE_ICON[m];
          return (
            <div key={m} className="flex flex-col gap-2">
              <h3 className="flex items-center gap-1.5 font-mono text-xs text-ink-3">
                <Icon className="size-3.5" />
                {MODE_LABEL[m].toUpperCase()}
              </h3>
              <div className="flex flex-col gap-2">
                {byMode.get(m)!.map((option) => (
                  <TravelOptionCard
                    key={option.id}
                    option={option}
                    voteCount={countsByOption.get(option.id) ?? 0}
                    votedByMe={votedByMe.has(option.id)}
                    votePending={pendingVoteIds.has(option.id)}
                    joinedNames={membersByOption.get(option.id) ?? []}
                    joinedByMe={joinedByMe.has(option.id)}
                    joinPending={pendingJoinIds.has(option.id)}
                    canDelete={option.member_id === myMemberId || isAdmin}
                    isAdmin={isAdmin}
                    onVote={() => vote(option.id)}
                    onJoin={() => join(option.id)}
                    onDelete={() => remove(option.id)}
                    onSetLocked={(locked) => setLocked(option.id, locked)}
                  />
                ))}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

function TravelOptionCard({
  option,
  voteCount,
  votedByMe,
  votePending,
  joinedNames,
  joinedByMe,
  joinPending,
  canDelete,
  isAdmin,
  onVote,
  onJoin,
  onDelete,
  onSetLocked,
}: {
  option: TravelOptionRow;
  voteCount: number;
  votedByMe: boolean;
  votePending: boolean;
  joinedNames: string[];
  joinedByMe: boolean;
  joinPending: boolean;
  canDelete: boolean;
  isAdmin: boolean;
  onVote: () => void;
  onJoin: () => void;
  onDelete: () => void;
  onSetLocked: (locked: boolean) => void;
}) {
  return (
    <div className={`flex flex-col gap-2 rounded-lg border p-3 ${option.locked ? "border-agent bg-agent-t" : "border-line bg-card"}`}>
      <div className="flex gap-3">
        <div className="min-w-0 flex-1">
          {option.url ? (
            <a href={option.url} target="_blank" rel="noreferrer" className="text-sm font-semibold hover:underline">
              {option.name}
            </a>
          ) : (
            <span className="text-sm font-semibold">{option.name}</span>
          )}
          <p className="text-xs text-ink-2">
            {[option.timing, option.price].filter(Boolean).join(" · ") || null}
          </p>
          {option.locked && <p className="mt-0.5 text-xs font-medium text-agent">Locked</p>}
          {joinedNames.length > 0 && (
            <p className="mt-1 text-xs text-ink-3">On this: {joinedNames.join(", ")}</p>
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
              onClick={() => onSetLocked(!option.locked)}
              aria-label={option.locked ? "Unlock" : "Lock"}
              className={option.locked ? "text-agent" : "text-ink-3 transition-colors hover:text-plum"}
            >
              {option.locked ? <Lock className="size-3.5" /> : <LockOpen className="size-3.5" />}
            </button>
          )}
          {canDelete && (
            <button onClick={onDelete} aria-label="Delete travel option" className="text-ink-3 transition-colors hover:text-stop">
              <Trash2 className="size-3.5" />
            </button>
          )}
        </div>
      </div>
      <button
        disabled={joinPending}
        onClick={onJoin}
        className={`self-start rounded-full border px-2.5 py-1 text-xs font-semibold transition-all disabled:cursor-not-allowed ${
          joinedByMe ? "border-agent bg-agent text-white" : "border-line text-ink-2"
        } ${joinPending ? "opacity-70" : "active:scale-95"}`}
      >
        {joinPending && <Loader2 className="mr-1 inline size-3 animate-spin" />}
        {joinedByMe ? "You're on this" : "I'm on this"}
      </button>
    </div>
  );
}
