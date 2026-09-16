import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { resolveCaller } from "@/lib/auth/resolve-caller";
import { TravelOptionsBoard } from "@/components/caravan/plan/travel-options-board";
import type { MemberRow, TravelOptionMemberRow, TravelOptionRow, TravelOptionVoteRow } from "@/lib/database.types";

export default async function TravelOptionsPage({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  const supabase = createServiceSupabaseClient();
  const caller = await resolveCaller(tripId, supabase);
  if (!caller || caller.status === "removed") notFound();

  const [{ data: travelOptions }, { data: activeMembers }] = await Promise.all([
    supabase.from("travel_options").select().eq("trip_id", tripId).order("created_at", { ascending: false }),
    supabase.from("members").select().eq("trip_id", tripId).eq("status", "active").order("joined_at", { ascending: true }),
  ]);
  const allTravelOptions = (travelOptions ?? []) as TravelOptionRow[];

  const travelOptionIds = allTravelOptions.map((t) => t.id);
  const [{ data: votes }, { data: joinedMembers }] = travelOptionIds.length
    ? await Promise.all([
        supabase.from("travel_option_votes").select().in("travel_option_id", travelOptionIds),
        supabase.from("travel_option_members").select().in("travel_option_id", travelOptionIds),
      ])
    : [{ data: [] as TravelOptionVoteRow[] }, { data: [] as TravelOptionMemberRow[] }];

  return (
    <div className="flex-1 flex flex-col gap-4 overflow-y-auto px-5 pb-8 pt-3 md:px-8">
      <div className="flex items-center gap-2">
        <Link href={`/trip/${tripId}/bookings`} aria-label="Back to Bookings" className="-ml-1 rounded-full p-1.5 transition-colors active:bg-sunk">
          <ChevronLeft className="size-5" />
        </Link>
        <h1 className="font-display text-lg font-semibold">Travel options</h1>
      </div>
      <p className="text-xs text-ink-3">
        Flights, buses, trains — from chat or added by hand, grouped by mode. Vote for your favorites and join the one you&rsquo;re actually taking; not everyone has to travel the same way.
      </p>
      <TravelOptionsBoard
        tripId={tripId}
        travelOptions={allTravelOptions}
        votes={(votes ?? []) as TravelOptionVoteRow[]}
        members={(joinedMembers ?? []) as TravelOptionMemberRow[]}
        activeMembers={(activeMembers ?? []) as MemberRow[]}
        myMemberId={caller.id}
        isAdmin={caller.role === "admin"}
      />
    </div>
  );
}
