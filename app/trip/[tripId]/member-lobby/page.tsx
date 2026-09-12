"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { AvatarStack } from "@/components/caravan/avatar";
import type { MemberRow, TripRow } from "@/lib/database.types";

export default function MemberLobbyPage() {
  const { tripId } = useParams<{ tripId: string }>();
  const router = useRouter();
  const [trip, setTrip] = useState<TripRow | null>(null);
  const [members, setMembers] = useState<MemberRow[]>([]);

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();

    async function load() {
      const [{ data: tripData }, { data: memberData }] = await Promise.all([
        supabase.from("trips").select().eq("id", tripId).single(),
        supabase.from("members").select().eq("trip_id", tripId).eq("status", "active"),
      ]);
      setTrip(tripData);
      setMembers(memberData ?? []);
    }
    load();

    const channel = supabase
      .channel(`member-lobby:${tripId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "trips", filter: `id=eq.${tripId}` },
        (payload) => {
          const updated = payload.new as TripRow;
          setTrip(updated);
          if (updated.status === "active") router.push(`/trip/${tripId}/room`);
        }
      )
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

  if (!trip) return <main className="p-5 text-ink-2">Loading&hellip;</main>;

  const you = members[members.length - 1];

  return (
    <main className="min-h-screen flex flex-col justify-center gap-4 px-5 text-center max-w-md mx-auto">
      <div className="flex justify-center mb-3.5">
        <AvatarStack members={members.map((m, i) => ({ name: m.display_name, colorIndex: i }))} />
      </div>
      <h1 className="font-display text-2xl font-semibold">You&rsquo;re in{you ? `, ${you.display_name}` : ""}</h1>
      <p className="text-[15px] text-ink-2">
        The admin hasn&rsquo;t opened the room yet. It&rsquo;ll unlock for everyone at once, and
        you&rsquo;ll get an email.
      </p>
    </main>
  );
}
