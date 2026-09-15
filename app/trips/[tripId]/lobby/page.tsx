"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Compass, Copy, Check } from "lucide-react";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { Avatar } from "@/components/caravan/avatar";
import { FlowShell } from "@/components/caravan/flow-shell";
import { Skeleton } from "@/components/caravan/skeleton";
import { EmptyState } from "@/components/caravan/empty-state";
import { LobbyIllustration } from "@/components/caravan/illustrations";
import { AmbientGlow } from "@/components/caravan/ambient-glow";
import { Switch } from "@/components/caravan/switch";
import { formatTimeAgo } from "@/lib/format-time-ago";
import { MIN_MEMBERS_TO_OPEN } from "@/lib/trips/constants";
import type { MemberRow, TripRow } from "@/lib/database.types";

export default function AdminLobbyPage() {
  const { tripId } = useParams<{ tripId: string }>();
  const router = useRouter();
  const [trip, setTrip] = useState<TripRow | null>(null);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [copied, setCopied] = useState(false);
  const [blockedNotice, setBlockedNotice] = useState(false);

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();

    async function load() {
      const { data: tripData } = await supabase.from("trips").select().eq("id", tripId).single();
      // This page is the pre-start "waiting for people to turn up" screen —
      // once the trip has actually been opened (or closed out), the admin
      // belongs in the room like everyone else, not back at a "still shut"
      // screen that can't be re-opened (start rejects a non-lobby trip).
      if (tripData && tripData.status !== "lobby") {
        router.replace(`/trip/${tripId}/room`);
        return;
      }
      setTrip(tripData);
      const { data: memberData } = await supabase
        .from("members")
        .select()
        .eq("trip_id", tripId)
        .eq("status", "active")
        .order("joined_at", { ascending: true });
      setMembers(memberData ?? []);
    }
    load();

    const channel = supabase
      .channel(`lobby:${tripId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "members", filter: `trip_id=eq.${tripId}` },
        (payload) => setMembers((cur) => [...cur, payload.new as MemberRow])
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tripId, router]);

  async function startTrip() {
    const res = await fetch(`/api/trips/${tripId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "start" }),
    });
    if (res.status === 409) {
      const body = await res.json().catch(() => ({}));
      if (body.error === "not_enough_members") {
        setBlockedNotice(true);
        return;
      }
      // Someone else already opened it in the meantime — the room is the
      // right place to land either way, not a silent no-op.
      router.push(`/trip/${tripId}/room`);
      return;
    }
    if (res.ok) router.push(`/trip/${tripId}/room`);
  }

  async function toggleJoining() {
    if (!trip) return;
    const res = await fetch(`/api/trips/${tripId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "toggle_joining" }),
    });
    if (res.ok) {
      const { trip: updated } = await res.json();
      setTrip(updated);
    }
  }

  async function copyCode() {
    if (!trip) return;
    await navigator.clipboard.writeText(`${window.location.origin}/join/${trip.invite_code}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (!trip) {
    return (
      <FlowShell>
        <div className="flex items-center gap-3 px-5 pt-4 pb-3 md:px-8">
          <Skeleton className="h-6 w-24 rounded-full" />
          <Skeleton className="ml-auto h-6 w-20 rounded-full" />
        </div>
        <div className="flex flex-col items-center gap-2 px-5 pb-5 md:px-8">
          <Skeleton className="h-7 w-40" />
        </div>
        <div className="flex-1 flex flex-col gap-4 px-5 md:px-8">
          <Skeleton className="h-24 w-full rounded-lg" />
          <Skeleton className="h-16 w-full rounded-lg" />
        </div>
        <div className="px-5 pb-10 pt-4 md:px-8">
          <Skeleton className="h-14 w-full rounded-xl" />
        </div>
      </FlowShell>
    );
  }

  const remaining = Math.max(0, MIN_MEMBERS_TO_OPEN - members.length);
  const canOpen = remaining === 0;
  const ctaCopy = canOpen
    ? "Open the room"
    : `Need ${remaining} more to open`;

  return (
    <FlowShell>
      <div className="relative overflow-hidden">
        <AmbientGlow />
        <div className="relative flex items-center gap-2 px-5 pt-4 pb-1 md:px-8">
          <Link
            href="/trips"
            className="flex items-center gap-1.5 rounded-full py-1.5 pl-1.5 pr-3 text-xs font-semibold text-plum transition-colors active:bg-plum-t"
          >
            <span className="grid size-6 place-items-center rounded-full bg-plum-t">
              <Compass className="size-3.5" />
            </span>
            My trips
          </Link>
          <button
            onClick={copyCode}
            className="ml-auto flex shrink-0 items-center gap-1.5 rounded-full border border-line bg-card px-3 py-1.5 font-mono text-[11px] text-ink-2 transition-colors active:bg-sunk"
          >
            {copied ? <Check className="size-3.5 text-agent" /> : <Copy className="size-3.5" />}
            {trip.invite_code}
          </button>
        </div>
        <div className="relative flex flex-col items-center gap-2 px-6 pb-5 pt-3 text-center">
          <h1 className="font-display text-2xl font-semibold">{trip.name}</h1>
          <div className="flex items-center gap-1.5 text-xs text-ink-2">
            <span className="relative flex size-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-signal-d opacity-75 motion-reduce:hidden" />
              <span className="relative inline-flex size-2 rounded-full bg-signal-d" />
            </span>
            Room&rsquo;s still shut &mdash; open it whenever you&rsquo;re ready
          </div>
          <p className="max-w-[280px] text-[11.5px] text-ink-3">
            Opens once at least {MIN_MEMBERS_TO_OPEN} people are here (you included) &mdash; a 1-2 person group barely needs a room.
          </p>
        </div>
      </div>

      <div className="flex-1 flex flex-col gap-4 px-5 md:px-8 overflow-y-auto">
        {members.length === 0 ? (
          <EmptyState
            icon={<LobbyIllustration size={96} />}
            title="Nobody's here yet"
            body="Send the code around — this screen updates the second someone joins."
          />
        ) : (
          <div className="flex flex-col gap-3 rounded-lg bg-card p-4">
            <div className="flex items-center justify-between">
              <span className="font-display text-base font-semibold">
                {members.length} {members.length === 1 ? "person" : "people"} here
              </span>
            </div>
            <div className="flex flex-col gap-3">
              {members.map((m, i) => (
                <div
                  key={m.id}
                  className="flex items-center gap-2.5 animate-in fade-in slide-in-from-bottom-1 duration-300"
                >
                  <Avatar name={m.display_name} colorIndex={i} />
                  <span className="text-sm font-medium">{m.display_name}</span>
                  <span className="ml-auto text-[11.5px] text-ink-3">
                    {m.role === "admin" ? "you, admin" : formatTimeAgo(m.joined_at)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mb-2 flex items-center justify-between rounded-lg bg-card px-4 py-3.5">
          <div>
            <div className="text-sm font-medium">{trip.joining_open ? "Joining open" : "Joining closed"}</div>
            <div className="mt-0.5 text-xs text-ink-3">
              {trip.joining_open ? "New people can still hop in on the code" : "Nobody new can join right now"}
            </div>
          </div>
          <Switch checked={trip.joining_open} onChange={toggleJoining} label="Toggle joining" />
        </div>
      </div>

      <div className="px-5 pb-10 pt-3 md:px-8">
        {blockedNotice && (
          <p className="mb-2 text-center text-xs font-medium text-stop">
            Still need {remaining} more &mdash; the room stays shut till then.
          </p>
        )}
        <button
          onClick={startTrip}
          disabled={!canOpen}
          className="w-full rounded-xl bg-signal py-4 font-semibold text-ink shadow-lg shadow-signal/30 transition-transform active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
        >
          {ctaCopy}
        </button>
      </div>
    </FlowShell>
  );
}
