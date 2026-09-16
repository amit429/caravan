import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { resolveCaller } from "@/lib/auth/resolve-caller";
import { AccommodationsBoard } from "@/components/caravan/plan/accommodations-board";
import type { AccommodationRow, AccommodationVoteRow } from "@/lib/database.types";

export default async function AccommodationsPage({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  const supabase = createServiceSupabaseClient();
  const caller = await resolveCaller(tripId, supabase);
  if (!caller || caller.status === "removed") notFound();

  const { data: accommodations } = await supabase
    .from("accommodations")
    .select()
    .eq("trip_id", tripId)
    .order("created_at", { ascending: false });
  const allAccommodations = (accommodations ?? []) as AccommodationRow[];

  const accommodationIds = allAccommodations.map((a) => a.id);
  const { data: votes } = accommodationIds.length
    ? await supabase.from("accommodation_votes").select().in("accommodation_id", accommodationIds)
    : { data: [] as AccommodationVoteRow[] };

  return (
    <div className="flex-1 flex flex-col gap-4 overflow-y-auto px-5 pb-8 pt-3 md:px-8">
      <div className="flex items-center gap-2">
        <Link href={`/trip/${tripId}/bookings`} aria-label="Back to Bookings" className="-ml-1 rounded-full p-1.5 transition-colors active:bg-sunk">
          <ChevronLeft className="size-5" />
        </Link>
        <h1 className="font-display text-lg font-semibold">Accommodations</h1>
      </div>
      <p className="text-xs text-ink-3">
        Hotel links and mentions from chat land here automatically, grouped by area — vote for your favorites, and the admin can lock in more than one for a multi-city trip.
      </p>
      <AccommodationsBoard
        tripId={tripId}
        accommodations={allAccommodations}
        votes={(votes ?? []) as AccommodationVoteRow[]}
        myMemberId={caller.id}
        isAdmin={caller.role === "admin"}
      />
    </div>
  );
}
