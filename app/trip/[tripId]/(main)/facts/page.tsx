import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { resolveCaller } from "@/lib/auth/resolve-caller";
import { MemberFactsBoard } from "@/components/caravan/plan/member-facts-board";
import type { FactRow, MemberRow } from "@/lib/database.types";

// Budget stays private forever — not even the admin sees an individual
// number here, only the aggregated ceiling shown on Plan (spec §7.4).
export default async function FactsPage({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  const supabase = createServiceSupabaseClient();
  const caller = await resolveCaller(tripId, supabase);
  if (!caller || caller.status === "removed") notFound();

  const [{ data: members }, { data: facts }] = await Promise.all([
    supabase.from("members").select().eq("trip_id", tripId).eq("status", "active").order("joined_at", { ascending: true }),
    supabase.from("facts").select().eq("trip_id", tripId).is("superseded_by", null).neq("category", "budget"),
  ]);

  return (
    <div className="flex-1 flex flex-col gap-4 overflow-y-auto px-5 pb-8 pt-3 md:px-8">
      <div className="flex items-center gap-2">
        <Link href={`/trip/${tripId}/plan`} aria-label="Back to Plan" className="-ml-1 rounded-full p-1.5 transition-colors active:bg-sunk">
          <ChevronLeft className="size-5" />
        </Link>
        <h1 className="font-display text-lg font-semibold">Everyone&rsquo;s answers</h1>
      </div>
      <MemberFactsBoard
        tripId={tripId}
        members={(members ?? []) as MemberRow[]}
        facts={(facts ?? []) as FactRow[]}
        myMemberId={caller.id}
      />
    </div>
  );
}
