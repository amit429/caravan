import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminUser } from "@/lib/auth/session";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { Card } from "@/components/caravan/card";

export default async function MyTripsPage() {
  const admin = await getAdminUser();
  if (!admin) redirect("/sign-in");

  const supabase = createServiceSupabaseClient();
  const { data: trips } = await supabase
    .from("trips")
    .select()
    .eq("admin_user_id", admin.id)
    .order("created_at", { ascending: false });

  return (
    <main className="min-h-screen flex flex-col max-w-md mx-auto px-5 pt-6 pb-10 gap-3">
      <h2 className="font-display text-2xl font-semibold mb-2">Your trips</h2>
      {(trips ?? []).map((trip) => (
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
      <div className="flex-1" />
      <Link href="/trips/new/basics" className="w-full py-4 rounded-xl bg-plum text-white text-center font-semibold">
        Start a trip
      </Link>
    </main>
  );
}
