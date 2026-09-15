import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { getAuthUser } from "@/lib/auth/session";
import { FlowShell } from "@/components/caravan/flow-shell";
import { ClosedGateIllustration } from "@/components/caravan/illustrations";
import { JoinWithGoogleButton } from "@/components/caravan/join-with-google-button";

export default async function InviteLandingPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const supabase = createServiceSupabaseClient();
  const { data: trip } = await supabase
    .from("trips")
    .select("id, name, rough_intent, joining_open, status")
    .eq("invite_code", code)
    .single();

  if (!trip) notFound();

  // Already signed in: resolve straight through instead of asking them to
  // tap "join" again — covers both "already a member, just resume" and "new
  // here, but no extra auth step needed since the session already exists".
  const authUser = await getAuthUser();
  if (authUser) redirect(`/join/${code}/complete`);

  if (!trip.joining_open || trip.status === "closed") {
    return (
      <FlowShell className="justify-center items-center gap-4 px-8 text-center">
        <ClosedGateIllustration className="text-ink-3" />
        <h1 className="font-display text-xl font-semibold">This trip isn&rsquo;t taking new members</h1>
        <p className="text-sm text-ink-2">Ask whoever invited you for a fresh link.</p>
      </FlowShell>
    );
  }

  const { count } = await supabase
    .from("members")
    .select("*", { count: "exact", head: true })
    .eq("trip_id", trip.id)
    .eq("status", "active");

  return (
    <FlowShell className="justify-end gap-4 px-5 pb-10 pt-8 md:justify-center md:px-8">
      <div className="flex-1 md:hidden" />
      <span className="inline-block w-fit text-xs font-semibold px-2.5 py-1 rounded-full bg-plum-t text-plum">
        You&rsquo;re invited
      </span>
      <h1 className="font-display text-3xl font-bold tracking-tight">{trip.name}</h1>
      {trip.rough_intent && <p className="text-[15px] text-ink-2">{trip.rough_intent}</p>}
      <p className="text-sm text-ink-2">{count ?? 0} already in</p>
      <div className="flex-1 md:hidden" />
      <JoinWithGoogleButton code={code} label="Join with Google" />
      <p className="text-xs text-ink-3 text-center">
        We use your Google account to confirm it&rsquo;s really you — no separate password, and you can find every trip
        you&rsquo;re in from any device.
      </p>
      <p className="text-xs text-ink-3 text-center">
        Not you? <Link href="/join" className="font-medium text-plum">Enter a different code</Link>
      </p>
    </FlowShell>
  );
}
