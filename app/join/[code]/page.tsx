import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { getMemberSession } from "@/lib/auth/session";

export default async function InviteLandingPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const supabase = createServiceSupabaseClient();
  const { data: trip } = await supabase
    .from("trips")
    .select("id, name, rough_intent, joining_open, status")
    .eq("invite_code", code)
    .single();

  if (!trip) notFound();

  // Duplicate join attempt with a still-valid cookie for THIS trip: resume silently
  // instead of showing the join form again (spec §8).
  const memberSession = await getMemberSession();
  if (memberSession && memberSession.tripId === trip.id) {
    redirect(trip.status === "active" ? `/trip/${trip.id}/room` : `/trip/${trip.id}/member-lobby`);
  }

  if (!trip.joining_open || trip.status === "closed") {
    return (
      <main className="min-h-screen flex flex-col justify-center px-5 max-w-md mx-auto text-center gap-3">
        <h1 className="font-display text-xl font-semibold">This trip isn&rsquo;t taking new members</h1>
        <p className="text-sm text-ink-2">Ask whoever invited you for a fresh link.</p>
      </main>
    );
  }

  const { count } = await supabase
    .from("members")
    .select("*", { count: "exact", head: true })
    .eq("trip_id", trip.id)
    .eq("status", "active");

  return (
    <main className="min-h-screen flex flex-col justify-end gap-4 px-5 pb-10 pt-8 max-w-md mx-auto">
      <div className="flex-1" />
      <span className="inline-block w-fit text-xs font-semibold px-2.5 py-1 rounded-full bg-plum-t text-plum">
        You&rsquo;re invited
      </span>
      <h1 className="font-display text-3xl font-bold tracking-tight">{trip.name}</h1>
      {trip.rough_intent && <p className="text-[15px] text-ink-2">{trip.rough_intent}</p>}
      <p className="text-sm text-ink-2">{count ?? 0} already in</p>
      <div className="flex-1" />
      <Link href={`/join/${code}/form`} className="w-full py-4 rounded-xl bg-plum text-white text-center font-semibold">
        Join the trip
      </Link>
      <p className="text-xs text-ink-3 text-center">No account needed. Takes about twenty seconds.</p>
    </main>
  );
}
