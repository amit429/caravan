import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { resolveCaller } from "@/lib/auth/resolve-caller";
import { BookingTracker } from "@/components/caravan/plan/booking-tracker";
import { SuggestedIdeas } from "@/components/caravan/plan/suggested-ideas";
import type { BookingRow, BookingStatusRow, IdeaRow, IdeaVoteRow, MemberRow } from "@/lib/database.types";

export default async function BookingsPage({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  const supabase = createServiceSupabaseClient();
  const caller = await resolveCaller(tripId, supabase);
  if (!caller || caller.status === "removed") notFound();

  const [{ data: bookings }, { data: members }, { data: suggestions }] = await Promise.all([
    supabase.from("bookings").select().eq("trip_id", tripId).order("created_at", { ascending: false }),
    supabase.from("members").select().eq("trip_id", tripId).eq("status", "active").order("joined_at", { ascending: true }),
    // Stay/travel ideas — chat-detected links and suggestions that haven't
    // been promoted into an actual tracked booking yet.
    supabase.from("ideas").select().eq("trip_id", tripId).in("category", ["stay", "travel"]).order("created_at", { ascending: false }),
  ]);

  const allBookings = (bookings ?? []) as BookingRow[];
  const bookingIds = allBookings.map((b) => b.id);
  const { data: statuses } = bookingIds.length
    ? await supabase.from("booking_status").select().in("booking_id", bookingIds)
    : { data: [] as BookingStatusRow[] };

  const allSuggestions = (suggestions ?? []) as IdeaRow[];
  const stays = allSuggestions.filter((i) => i.category === "stay");
  const travel = allSuggestions.filter((i) => i.category === "travel");
  const suggestionIds = allSuggestions.map((i) => i.id);
  const { data: suggestionVotes } = suggestionIds.length
    ? await supabase.from("idea_votes").select().in("idea_id", suggestionIds)
    : { data: [] as IdeaVoteRow[] };
  const allSuggestionVotes = (suggestionVotes ?? []) as IdeaVoteRow[];
  const isAdmin = caller.role === "admin";

  return (
    <div className="flex-1 flex flex-col gap-4 overflow-y-auto px-5 pb-8 pt-3 md:px-8">
      <div className="flex items-center gap-2">
        <Link href={`/trip/${tripId}/plan`} aria-label="Back to Plan" className="-ml-1 rounded-full p-1.5 transition-colors active:bg-sunk">
          <ChevronLeft className="size-5" />
        </Link>
        <h1 className="font-display text-lg font-semibold">Bookings</h1>
      </div>
      <p className="text-xs text-ink-3">Caravan never takes money or makes a booking. It just refuses to let you forget.</p>
      <SuggestedIdeas
        tripId={tripId}
        title="SUGGESTED STAYS"
        ideas={stays}
        votes={allSuggestionVotes}
        myMemberId={caller.id}
        isAdmin={isAdmin}
      />
      <SuggestedIdeas
        tripId={tripId}
        title="SUGGESTED TRAVEL"
        ideas={travel}
        votes={allSuggestionVotes}
        myMemberId={caller.id}
        isAdmin={isAdmin}
      />
      <section className="flex flex-col gap-2">
        <h3 className="font-mono text-xs text-ink-3">TRACKING</h3>
        <BookingTracker
          tripId={tripId}
          bookings={allBookings}
          statuses={(statuses ?? []) as BookingStatusRow[]}
          members={(members ?? []) as MemberRow[]}
          myMemberId={caller.id}
          isAdmin={isAdmin}
        />
      </section>
    </div>
  );
}
