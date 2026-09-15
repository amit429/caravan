import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { getAuthUser } from "@/lib/auth/session";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { CompassIllustration } from "@/components/caravan/illustrations";
import { AccountMenu } from "@/components/caravan/account-menu";
import { AvatarStack } from "@/components/caravan/avatar";
import type { MemberRow, TripRow } from "@/lib/database.types";

const STATUS_STYLE: Record<TripRow["status"], { label: string; className: string }> = {
  lobby: { label: "Draft", className: "bg-warn-t text-warn" },
  active: { label: "Moving", className: "bg-agent-t text-agent" },
  closed: { label: "Closed", className: "bg-sunk text-ink-3" },
};

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

  const tripIds = trips.map((t) => t.id);
  const { data: allMembers } = tripIds.length
    ? await supabase.from("members").select().in("trip_id", tripIds).eq("status", "active").order("joined_at", { ascending: true })
    : { data: [] as MemberRow[] };
  const membersByTrip = new Map<string, MemberRow[]>();
  for (const m of (allMembers ?? []) as MemberRow[]) {
    const list = membersByTrip.get(m.trip_id) ?? [];
    list.push(m);
    membersByTrip.set(m.trip_id, list);
  }

  function tripHref(trip: TripRow & { myRole: "member" | "admin" }) {
    if (trip.status !== "lobby") return `/trip/${trip.id}/room`;
    return trip.myRole === "admin" ? `/trips/${trip.id}/lobby` : `/trip/${trip.id}/member-lobby`;
  }

  return (
    <main className="min-h-dvh flex flex-col mx-auto w-full max-w-md md:max-w-2xl px-5 pt-6 pb-10 gap-4 md:px-8">
      <div className="flex items-center gap-3">
        <div className="grid size-10 shrink-0 place-items-center rounded-2xl bg-plum-t text-plum">
          <CompassIllustration size={22} />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-2xl font-semibold">Your trips</h2>
          <p className="text-xs text-ink-3">Every trip you&rsquo;re part of, in one place.</p>
        </div>
        <AccountMenu email={authUser.email} />
      </div>

      {hasTrips ? (
        <div className="flex flex-col gap-3 md:grid md:grid-cols-2 md:gap-4">
          {trips.map((trip) => {
            const tripMembers = membersByTrip.get(trip.id) ?? [];
            const status = STATUS_STYLE[trip.status];
            return (
              <Link
                key={trip.id}
                href={tripHref(trip)}
                className="group flex flex-col gap-3 rounded-lg border border-line bg-card p-4 transition-all active:scale-[0.98] hover:border-plum/40 hover:shadow-md"
              >
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <span className="font-display text-base font-semibold leading-tight">{trip.name}</span>
                    {trip.rough_intent && <p className="mt-0.5 truncate text-xs text-ink-3">{trip.rough_intent}</p>}
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold ${status.className}`}>
                    {status.label}
                  </span>
                </div>
                <div className="flex items-center gap-2.5">
                  {tripMembers.length > 0 ? (
                    <AvatarStack
                      members={tripMembers.slice(0, 5).map((m, idx) => ({ name: m.display_name, colorIndex: idx }))}
                    />
                  ) : null}
                  <span className="text-xs text-ink-3">
                    {tripMembers.length} {tripMembers.length === 1 ? "person" : "people"}
                    {trip.myRole === "member" ? " · you're a member" : ""}
                  </span>
                  <ChevronRight className="ml-auto size-4 shrink-0 text-ink-3 transition-transform group-hover:translate-x-0.5" />
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center gap-5 px-8 text-center">
          <CompassIllustration className="text-plum" size={112} />
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
        <Link href="/trips/new/basics" className="w-full py-4 rounded-xl bg-plum text-white text-center font-semibold transition-transform active:scale-[0.98]">
          Start a trip
        </Link>
        <Link href="/join" className="w-full py-4 rounded-xl border border-line text-center font-semibold transition-colors hover:bg-sunk">
          I have an invite code
        </Link>
      </div>
    </main>
  );
}
