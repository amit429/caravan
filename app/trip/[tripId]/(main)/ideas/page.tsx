import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { resolveCaller } from "@/lib/auth/resolve-caller";
import { IdeaInbox } from "@/components/caravan/plan/idea-inbox";
import type { IdeaRow, IdeaVoteRow } from "@/lib/database.types";

export default async function IdeasPage({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  const supabase = createServiceSupabaseClient();
  const caller = await resolveCaller(tripId, supabase);
  if (!caller || caller.status === "removed") notFound();

  // Stay/travel-categorized ideas get their own home on Bookings (suggested
  // stays / suggested travel) — showing them here too would just duplicate
  // the same card in two places.
  const { data: ideas } = await supabase
    .from("ideas")
    .select()
    .eq("trip_id", tripId)
    .eq("category", "activity")
    .order("created_at", { ascending: false });

  const allIdeas = (ideas ?? []) as IdeaRow[];
  const ideaIds = allIdeas.map((i) => i.id);
  const { data: votes } = ideaIds.length
    ? await supabase.from("idea_votes").select().in("idea_id", ideaIds)
    : { data: [] as IdeaVoteRow[] };

  return (
    <div className="flex-1 flex flex-col gap-4 overflow-y-auto px-5 pb-8 pt-3 md:px-8">
      <div className="flex items-center gap-2">
        <Link href={`/trip/${tripId}/plan`} aria-label="Back to Plan" className="-ml-1 rounded-full p-1.5 transition-colors active:bg-sunk">
          <ChevronLeft className="size-5" />
        </Link>
        <h1 className="font-display text-lg font-semibold">Ideas</h1>
      </div>
      <p className="text-xs text-ink-3">Everything anyone pasted into the room. Vote and it moves into the plan.</p>
      <IdeaInbox tripId={tripId} ideas={allIdeas} votes={(votes ?? []) as IdeaVoteRow[]} myMemberId={caller.id} isAdmin={caller.role === "admin"} />
    </div>
  );
}
