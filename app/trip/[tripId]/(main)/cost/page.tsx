import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { resolveCaller } from "@/lib/auth/resolve-caller";
import { budgetBandCeiling } from "@/lib/budget";
import { flagMembersOverBudget } from "@/lib/cost-flags";
import { GenerateCostEstimateButton } from "@/components/caravan/generate-cost-estimate-button";
import { EmptyState } from "@/components/caravan/empty-state";
import { ReceiptIllustration } from "@/components/caravan/illustrations";
import type { CostEstimateRow, FactRow } from "@/lib/database.types";

export default async function CostPage({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  const supabase = createServiceSupabaseClient();
  const caller = await resolveCaller(tripId, supabase);
  if (!caller || caller.status === "removed") notFound();

  const [{ data: costEstimate }, { data: facts }] = await Promise.all([
    supabase.from("cost_estimates").select().eq("trip_id", tripId).maybeSingle(),
    supabase.from("facts").select().eq("trip_id", tripId).is("superseded_by", null).eq("category", "budget"),
  ]);

  const isAdmin = caller.role === "admin";
  const estimate = costEstimate as CostEstimateRow | null;

  let overCount = 0;
  let underCount = 0;
  if (estimate) {
    const ceilings = ((facts ?? []) as FactRow[])
      .map((f) => budgetBandCeiling((f.value as { band: string }).band))
      .filter((c): c is number => c !== null);
    overCount = flagMembersOverBudget(
      estimate.max_per_head,
      ceilings.map((ceiling, i) => ({ memberId: String(i), ceiling }))
    ).length;
    underCount = ceilings.length - overCount;
  }

  return (
    <div className="flex-1 flex flex-col gap-4 overflow-y-auto px-5 pb-8 pt-3 md:px-8">
      <div className="flex items-center gap-2">
        <Link href={`/trip/${tripId}/plan`} aria-label="Back to Plan" className="-ml-1 rounded-full p-1.5 transition-colors active:bg-sunk">
          <ChevronLeft className="size-5" />
        </Link>
        <h1 className="font-display text-lg font-semibold">Cost</h1>
      </div>

      {estimate ? (
        <>
          <div className="rounded-lg bg-card p-4">
            <span className="font-mono text-[10px] text-ink-3">A HEAD, AS PLANNED</span>
            <p className="mt-1.5 font-display text-2xl font-bold">
              &#8377;{estimate.min_per_head.toLocaleString("en-IN")}&ndash;{estimate.max_per_head.toLocaleString("en-IN")}
            </p>
            <p className="mt-1 text-sm text-ink-2">for {estimate.destination}</p>
          </div>
          <div className="rounded-lg bg-card p-4">
            <span className="font-mono text-[10px] text-ink-3">AGAINST WHAT PEOPLE CAN SPEND</span>
            <p className="mt-2 text-sm">
              {overCount > 0 ? (
                <>
                  <span className="font-semibold text-stop">{overCount}</span> {overCount === 1 ? "person" : "people"} would go
                  over their ceiling. {underCount} clear it.
                </>
              ) : (
                <span className="font-semibold text-signal-d">Everyone clears it.</span>
              )}
            </p>
          </div>
          <div className="rounded-lg border border-line bg-transparent p-3.5">
            <p className="text-xs text-ink-3">{estimate.assumptions}</p>
          </div>
          <div className="rounded-lg border border-line bg-transparent p-3.5">
            <p className="text-xs text-ink-3">Individual budgets are never shown here, to anyone, including the admin.</p>
          </div>
          {isAdmin && (
            <div className="self-start">
              <GenerateCostEstimateButton tripId={tripId} label="Re-estimate" />
            </div>
          )}
        </>
      ) : isAdmin ? (
        <EmptyState
          icon={<ReceiptIllustration size={96} />}
          title="No cost estimate yet"
          body="Once a destination's locked, the agent can put together a realistic per-head range."
          action={<GenerateCostEstimateButton tripId={tripId} label="Estimate cost" />}
        />
      ) : (
        <EmptyState
          icon={<ReceiptIllustration size={96} />}
          title="No cost estimate yet"
          body="The admin generates this once a destination's locked in."
        />
      )}
    </div>
  );
}
