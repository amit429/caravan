import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { resolveCaller } from "@/lib/auth/resolve-caller";
import { BookingTracker } from "@/components/caravan/plan/booking-tracker";
import type { BookingRow, BookingStatusRow, MemberRow } from "@/lib/database.types";

export default async function BookingsPage({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  const supabase = createServiceSupabaseClient();
  const caller = await resolveCaller(tripId, supabase);
  if (!caller || caller.status === "removed") notFound();

  const [{ data: bookings }, { data: members }, { count: accommodationCount }, { count: travelOptionCount }] = await Promise.all([
    supabase.from("bookings").select().eq("trip_id", tripId).order("created_at", { ascending: false }),
    supabase.from("members").select().eq("trip_id", tripId).eq("status", "active").order("joined_at", { ascending: true }),
    supabase.from("accommodations").select("id", { count: "exact", head: true }).eq("trip_id", tripId),
    supabase.from("travel_options").select("id", { count: "exact", head: true }).eq("trip_id", tripId),
  ]);

  const allBookings = (bookings ?? []) as BookingRow[];
  const bookingIds = allBookings.map((b) => b.id);
  const { data: statuses } = bookingIds.length
    ? await supabase.from("booking_status").select().in("booking_id", bookingIds)
    : { data: [] as BookingStatusRow[] };

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
      <section className="flex flex-col gap-2">
        <h3 className="font-mono text-xs text-ink-3">ACCOMMODATIONS</h3>
        <Link
          href={`/trip/${tripId}/accommodations`}
          className="flex items-center gap-3 rounded-lg bg-card p-3.5 transition-colors hover:bg-sunk"
        >
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold">
              {accommodationCount ? `${accommodationCount} stay${accommodationCount === 1 ? "" : "s"} suggested` : "Nothing suggested yet"}
            </div>
            <div className="mt-0.5 text-xs text-ink-3">Hotel links from chat, grouped by area — vote and lock multiple</div>
          </div>
          <ChevronRight className="size-4 shrink-0 text-ink-3" />
        </Link>
      </section>
      <section className="flex flex-col gap-2">
        <h3 className="font-mono text-xs text-ink-3">TRAVEL OPTIONS</h3>
        <Link
          href={`/trip/${tripId}/travel-options`}
          className="flex items-center gap-3 rounded-lg bg-card p-3.5 transition-colors hover:bg-sunk"
        >
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold">
              {travelOptionCount ? `${travelOptionCount} option${travelOptionCount === 1 ? "" : "s"} suggested` : "Nothing suggested yet"}
            </div>
            <div className="mt-0.5 text-xs text-ink-3">Flights, buses, trains from chat — grouped by mode, join the one you&rsquo;re on</div>
          </div>
          <ChevronRight className="size-4 shrink-0 text-ink-3" />
        </Link>
      </section>
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
