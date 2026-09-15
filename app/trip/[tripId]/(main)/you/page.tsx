import Link from "next/link";
import { notFound } from "next/navigation";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { resolveCaller } from "@/lib/auth/resolve-caller";
import { ThreadIllustration } from "@/components/caravan/illustrations";
import { Card } from "@/components/caravan/card";

export default async function YouPage({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  const supabase = createServiceSupabaseClient();
  const caller = await resolveCaller(tripId, supabase);
  if (!caller || caller.status === "removed") notFound();

  const { count } = await supabase
    .from("facts")
    .select("*", { count: "exact", head: true })
    .eq("trip_id", tripId)
    .eq("member_id", caller.id);
  const intakeDone = (count ?? 0) > 0;

  if (!intakeDone) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-5 px-8 text-center">
        <ThreadIllustration className="text-plum" />
        <div className="flex flex-col gap-1.5">
          <h2 className="font-display text-lg font-semibold">Five quick questions</h2>
          <p className="text-sm text-ink-2 max-w-[280px]">
            Your dates, budget, and vibe — about 90 seconds, mostly taps.
          </p>
        </div>
        <Link href={`/trip/${tripId}/intake`} className="w-full max-w-[280px] py-3.5 rounded-xl bg-plum text-white text-center font-semibold">
          Answer them
        </Link>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col gap-3 px-5 pt-5 md:px-8">
      <Card>
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <div className="text-sm font-semibold">Your answers are in</div>
            <div className="text-xs text-ink-3 mt-0.5">Dates, budget, and vibe are counted in the plan.</div>
          </div>
          <Link href={`/trip/${tripId}/intake`} className="text-sm font-medium text-plum">
            Edit
          </Link>
        </div>
      </Card>
    </div>
  );
}
