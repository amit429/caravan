import { redirect, notFound } from "next/navigation";
import { getAuthUser } from "@/lib/auth/session";
import { joinTripAsMember } from "@/lib/trips/join-as-member";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { FlowShell } from "@/components/caravan/primitives/flow-shell";
import { ClosedGateIllustration } from "@/components/caravan/primitives/illustrations";

// Lands here straight out of the Google OAuth callback (see
// JoinWithGoogleButton's `next` param) with a real session already set, or
// directly from the invite page for someone already signed in. Either way,
// by the time this renders there's a Supabase Auth session — the actual
// join-or-resume happens here, then it's a straight redirect, no button to
// press.
export default async function JoinCompletePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const authUser = await getAuthUser();
  if (!authUser) redirect(`/join/${code}`);

  const result = await joinTripAsMember(code, authUser);

  if (!result.ok) {
    if (result.reason === "not_found") notFound();
    return (
      <FlowShell className="justify-center items-center gap-4 px-8 text-center">
        <ClosedGateIllustration className="text-ink-3" />
        <h1 className="font-display text-xl font-semibold">
          {result.reason === "removed" ? "You were removed from this trip" : "This trip isn't taking new members"}
        </h1>
        <p className="text-sm text-ink-2">Ask whoever invited you for a fresh link.</p>
      </FlowShell>
    );
  }

  const supabase = createServiceSupabaseClient();
  const { data: trip } = await supabase.from("trips").select("status").eq("id", result.member.trip_id).single();
  redirect(trip?.status === "active" ? `/trip/${result.member.trip_id}/room` : `/trip/${result.member.trip_id}/member-lobby`);
}
