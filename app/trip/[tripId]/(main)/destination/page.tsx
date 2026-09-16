import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { resolveCaller } from "@/lib/auth/resolve-caller";
import { DecisionCard } from "@/components/caravan/decisions/decision-card";
import { GenerateDestinationsButton } from "@/components/caravan/generate/generate-destinations-button";
import { EmptyState } from "@/components/caravan/primitives/empty-state";
import { CompassIllustration } from "@/components/caravan/primitives/illustrations";
import type { DecisionRow, VoteRow } from "@/lib/database.types";

// F4/F8 (docs/design/screens.html): the hero moment — three places with real
// tradeoff reasoning — gets its own screen instead of living inline on Plan,
// where it was the single biggest thing crowding out everything else.
export default async function DestinationPage({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  const supabase = createServiceSupabaseClient();
  const caller = await resolveCaller(tripId, supabase);
  if (!caller || caller.status === "removed") notFound();

  const { data: decisions } = await supabase
    .from("decisions")
    .select()
    .eq("trip_id", tripId)
    .eq("type", "DESTINATION")
    .order("created_at", { ascending: false });
  const destinationDecision = ((decisions ?? []) as DecisionRow[])[0];

  const isAdmin = caller.role === "admin";

  let votes: VoteRow[] = [];
  if (destinationDecision) {
    const { data } = await supabase.from("votes").select().eq("decision_id", destinationDecision.id);
    votes = (data ?? []) as VoteRow[];
  }

  return (
    <div className="flex-1 flex flex-col gap-4 overflow-y-auto px-5 pb-8 pt-3 md:px-8">
      <div className="flex items-center gap-2">
        <Link href={`/trip/${tripId}/plan`} aria-label="Back to Plan" className="-ml-1 rounded-full p-1.5 transition-colors active:bg-sunk">
          <ChevronLeft className="size-5" />
        </Link>
        <h1 className="font-display text-lg font-semibold">Where are we going?</h1>
      </div>

      {destinationDecision ? (
        <DecisionCard
          tripId={tripId}
          decision={destinationDecision}
          votes={votes}
          isAdmin={isAdmin}
          myMemberId={caller.id}
          showDetailLink={false}
        />
      ) : isAdmin ? (
        <EmptyState
          icon={<CompassIllustration size={96} />}
          title="Nobody's picked a direction yet"
          body="Once the group has shared budgets, vibes, and a departure city, the agent can put together three real options."
          action={<GenerateDestinationsButton tripId={tripId} />}
        />
      ) : (
        <EmptyState
          icon={<CompassIllustration size={96} />}
          title="Nobody's put together options yet"
          body="The admin generates these once the group's shared enough to work with."
        />
      )}
    </div>
  );
}
