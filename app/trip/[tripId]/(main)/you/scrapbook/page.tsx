import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { resolveCaller } from "@/lib/auth/resolve-caller";
import { Scrapbook } from "@/components/caravan/room/scrapbook";
import type { FactRow, IdeaRow } from "@/lib/database.types";

export default async function ScrapbookPage({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  const supabase = createServiceSupabaseClient();
  const caller = await resolveCaller(tripId, supabase);
  if (!caller || caller.status === "removed") notFound();

  const [{ data: facts }, { data: ideas }] = await Promise.all([
    supabase.from("facts").select().eq("trip_id", tripId).eq("member_id", caller.id).is("superseded_by", null),
    supabase.from("ideas").select().eq("trip_id", tripId).eq("member_id", caller.id).order("created_at", { ascending: false }),
  ]);

  return (
    <div className="flex-1 flex flex-col gap-4 overflow-y-auto px-5 pb-8 pt-3 md:px-8">
      <div className="flex items-center gap-2">
        <Link href={`/trip/${tripId}/you`} aria-label="Back to You" className="-ml-1 rounded-full p-1.5 transition-colors active:bg-sunk">
          <ChevronLeft className="size-5" />
        </Link>
        <h1 className="font-display text-lg font-semibold">Your scrapbook</h1>
      </div>
      <Scrapbook facts={(facts ?? []) as FactRow[]} ideas={(ideas ?? []) as IdeaRow[]} />
    </div>
  );
}
