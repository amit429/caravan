import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth/session";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { Card } from "@/components/caravan/card";
import { CompassIllustration } from "@/components/caravan/illustrations";
import { AccountMenu } from "@/components/caravan/account-menu";
import type { TripRow } from "@/lib/database.types";

export default async function MyTripsPage() {
  const authUser = await getAuthUser();
  if (!authUser) redirect("/sign-in");

  // Everyone authenticates the same way now, so "your trips" is just every
  // trip you have an active members row on — admin (role='admin', mirrored
  // in at creation) and plain member both fall out of the same query.
  const supabase = createServiceSupabaseClient();
  const { data: rows } = await supabase
    .from("members")
    .select("role, trips(*)")
    .eq("email", authUser.email)
    .eq("status", "active")
    .order("created_at", { referencedTable: "trips", ascending: false });

  const trips = ((rows ?? []) as unknown as { role: "member" | "admin"; trips: TripRow }[])
    .filter((r) => r.trips)
    .map((r) => ({ ...r.trips, myRole: r.role }));
  const hasTrips = trips.length > 0;

  function tripHref(trip: TripRow & { myRole: "member" | "admin" }) {
    if (trip.status !== "lobby") return `/trip/${trip.id}/room`;
    return trip.myRole === "admin" ? `/trips/${trip.id}/lobby` : `/trip/${trip.id}/member-lobby`;
  }

  return (
    <main className="min-h-dvh flex flex-col mx-auto w-full max-w-md md:max-w-2xl px-5 pt-6 pb-10 gap-3 md:px-8">
      <div className="flex items-center mb-2">
        <h2 className="font-display text-2xl font-semibold">Your trips</h2>
        <div className="ml-auto">
          <AccountMenu email={authUser.email} />
        </div>
      </div>
      {hasTrips ? (
        <div className="flex flex-col gap-3 md:grid md:grid-cols-2 md:gap-4">
          {trips.map((trip) => (
            <Link key={trip.id} href={tripHref(trip)} className="block transition-transform active:scale-[0.98]">
              <Card className="transition-colors hover:bg-sunk">
                <div className="flex items-center">
                  <span className="font-display text-base font-semibold">{trip.name}</span>
                  <span className="ml-auto text-[10px] font-medium px-2 py-1 rounded-full bg-sunk text-ink-2">
                    {trip.status === "lobby" ? "Draft" : trip.status === "active" ? "Moving" : "Closed"}
                  </span>
                </div>
                {trip.myRole === "member" && <p className="mt-1 text-xs text-ink-3">You&rsquo;re a member</p>}
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center gap-5 px-8 text-center">
          <CompassIllustration className="text-plum" />
          <div className="flex flex-col gap-1.5">
            <h3 className="font-display text-lg font-semibold">No trips yet</h3>
            <p className="text-sm text-ink-2 max-w-[280px]">
              Start one, share the link, and let people drop their dates from their own phone.
            </p>
          </div>
        </div>
      )}
      <div className="flex-1 md:hidden" />
      <div className="flex flex-col gap-2.5">
        <Link href="/trips/new/basics" className="w-full py-4 rounded-xl bg-plum text-white text-center font-semibold">
          Start a trip
        </Link>
        <Link href="/join" className="w-full py-4 rounded-xl border border-line text-center font-semibold">
          I have an invite code
        </Link>
      </div>
    </main>
  );
}
