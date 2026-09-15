import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { resolveCaller } from "@/lib/auth/resolve-caller";
import { getAdminUser } from "@/lib/auth/session";
import { BookingTracker } from "@/components/caravan/booking-tracker";
import type { BookingRow, BookingStatusRow, MemberRow } from "@/lib/database.types";

export default async function BookingsPage({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  const supabase = createServiceSupabaseClient();
  const caller = await resolveCaller(tripId, supabase);
  if (!caller || caller.status === "removed") notFound();

  const [{ data: bookings }, { data: members }, admin] = await Promise.all([
    supabase.from("bookings").select().eq("trip_id", tripId).order("created_at", { ascending: false }),
    supabase.from("members").select().eq("trip_id", tripId).eq("status", "active").order("joined_at", { ascending: true }),
    getAdminUser(),
  ]);

  const allBookings = (bookings ?? []) as BookingRow[];
  const bookingIds = allBookings.map((b) => b.id);
  const { data: statuses } = bookingIds.length
    ? await supabase.from("booking_status").select().in("booking_id", bookingIds)
    : { data: [] as BookingStatusRow[] };

  return (
    <div className="flex-1 flex flex-col gap-4 overflow-y-auto px-5 pb-8 pt-3 md:px-8">
      <div className="flex items-center gap-2">
        <Link href={`/trip/${tripId}/plan`} aria-label="Back to Plan" className="-ml-1 rounded-full p-1.5 transition-colors active:bg-sunk">
          <ChevronLeft className="size-5" />
        </Link>
        <h1 className="font-display text-lg font-semibold">Bookings</h1>
      </div>
      <p className="text-xs text-ink-3">Caravan never takes money or makes a booking. It just refuses to let you forget.</p>
      <BookingTracker
        tripId={tripId}
        bookings={allBookings}
        statuses={(statuses ?? []) as BookingStatusRow[]}
        members={(members ?? []) as MemberRow[]}
        myMemberId={caller.id}
        isAdmin={!!admin}
      />
    </div>
  );
}
