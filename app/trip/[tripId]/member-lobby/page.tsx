"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { AvatarStack } from "@/components/caravan/avatar";
import { FlowShell } from "@/components/caravan/flow-shell";
import type { MemberRow } from "@/lib/database.types";

type LobbyTrip = { id: string; name: string; status: string };

export default function MemberLobbyPage() {
  const { tripId } = useParams<{ tripId: string }>();
  const router = useRouter();
  const [trip, setTrip] = useState<LobbyTrip | null>(null);
  const [members, setMembers] = useState<MemberRow[]>([]);

  useEffect(() => {
    // Members have no Supabase Auth session (spec §10), so RLS blocks direct
    // table reads and postgres_changes never reaches them (see
    // lib/realtime/broadcast) — this fetches through the dual-auth API route
    // and listens on the broadcast channel like RealtimeRefresh does.
    let cancelled = false;

    async function load() {
      const res = await fetch(`/api/trips/${tripId}`);
      if (!res.ok || cancelled) return;
      const data: { trip: LobbyTrip; members: MemberRow[] } = await res.json();
      setTrip(data.trip);
      setMembers(data.members);
      if (data.trip.status === "active") router.push(`/trip/${tripId}/room`);
    }
    load();

    const supabase = createBrowserSupabaseClient();
    const channel = supabase
      .channel(`trip:${tripId}`)
      .on("broadcast", { event: "change" }, () => load())
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [tripId, router]);

  if (!trip) return <main className="p-5 text-ink-2">Loading&hellip;</main>;

  const you = members[members.length - 1];

  return (
    <FlowShell className="justify-center gap-4 px-5 text-center md:px-8">
      <div className="flex justify-center mb-3.5">
        <AvatarStack members={members.map((m, i) => ({ name: m.display_name, colorIndex: i }))} />
      </div>
      <h1 className="font-display text-2xl font-semibold">You&rsquo;re in{you ? `, ${you.display_name}` : ""}</h1>
      <p className="text-[15px] text-ink-2">
        The admin hasn&rsquo;t opened the room yet. It&rsquo;ll unlock for everyone at once, and
        you&rsquo;ll get an email.
      </p>
    </FlowShell>
  );
}
