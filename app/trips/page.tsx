import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminUser } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Card } from "@/components/caravan/card";
import { CompassIllustration } from "@/components/caravan/illustrations";
import { AccountMenu } from "@/components/caravan/account-menu";

export default async function MyTripsPage() {
  const admin = await getAdminUser();
  if (!admin) redirect("/sign-in");

  const supabase = await createServerSupabaseClient();
  const { data: trips } = await supabase
    .from("trips")
    .select()
    .eq("admin_user_id", admin.id)
    .order("created_at", { ascending: false });

  const hasTrips = (trips ?? []).length > 0;

  return (
    <main className="min-h-dvh flex flex-col mx-auto w-full max-w-md md:max-w-2xl px-5 pt-6 pb-10 gap-3 md:px-8">
      <div className="flex items-center mb-2">
        <h2 className="font-display text-2xl font-semibold">Your trips</h2>
        <div className="ml-auto">
          <AccountMenu email={admin.email} />
        </div>
      </div>
      {hasTrips ? (
        <div className="flex flex-col gap-3 md:grid md:grid-cols-2 md:gap-4">
          {trips!.map((trip) => (
            <Link key={trip.id} href={`/trips/${trip.id}/lobby`}>
              <Card>
                <div className="flex items-center">
                  <span className="font-display text-base font-semibold">{trip.name}</span>
                  <span className="ml-auto text-[10px] font-medium px-2 py-1 rounded-full bg-sunk text-ink-2">
                    {trip.status === "lobby" ? "Draft" : trip.status === "active" ? "Moving" : "Closed"}
                  </span>
                </div>
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
