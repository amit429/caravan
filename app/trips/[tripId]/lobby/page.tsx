"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { AppBar } from "@/components/caravan/app-bar";
import { Avatar } from "@/components/caravan/avatar";
import { FlowShell } from "@/components/caravan/flow-shell";
import type { MemberRow, TripRow } from "@/lib/database.types";

export default function AdminLobbyPage() {
  const { tripId } = useParams<{ tripId: string }>();
  const router = useRouter();
  const [trip, setTrip] = useState<TripRow | null>(null);
  const [members, setMembers] = useState<MemberRow[]>([]);

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
        .eq("status", "active");
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
    // Even if this 409s because someone else already opened it in the
    // meantime, the room is the right place to land, not a silent no-op.
    if (res.ok || res.status === 409) router.push(`/trip/${tripId}/room`);
  }

  async function toggleJoining() {
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

  if (!trip) return <main className="p-5 text-ink-2">Loading&hellip;</main>;

  return (
    <FlowShell>
      <AppBar title={trip.name} back={false} right={trip.invite_code} />
      <div className="flex-1 flex flex-col gap-4 px-5 md:px-8 overflow-y-auto">
        <div className="bg-card rounded-lg text-center p-5">
          <h1 className="font-display text-2xl font-semibold">{members.length} here, room still shut</h1>
          <p className="text-sm text-ink-2 mt-1.5">
            Open it when you think enough people have turned up.
          </p>
        </div>
        <div className="bg-card rounded-lg divide-y divide-line">
          {members.map((m, i) => (
            <div key={m.id} className="flex items-center gap-2.5 py-3 px-4">
              <Avatar name={m.display_name} colorIndex={i} />
              <div className="flex flex-col">
                <span className="text-sm font-medium">{m.display_name}</span>
                <span className="text-[11.5px] text-ink-3">{m.role === "admin" ? "you, admin" : "joined"}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="flex items-center">
          <span className="text-[10.5px] font-semibold px-2.5 py-1 rounded-full bg-sunk text-ink-2">
            {trip.joining_open ? "Joining open" : "Joining closed"}
          </span>
          <button onClick={toggleJoining} className="ml-auto text-sm text-ink-2 underline">
            {trip.joining_open ? "Shut it" : "Reopen it"}
          </button>
        </div>
      </div>
      <div className="px-5 pb-10 pt-4 md:px-8">
        <button onClick={startTrip} className="w-full py-4 rounded-xl bg-signal text-ink font-semibold">
          Open the room
        </button>
      </div>
    </FlowShell>
  );
}
