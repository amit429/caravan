import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { TabBar } from "@/components/caravan/tab-bar";
import { SidebarNav } from "@/components/caravan/sidebar-nav";
import { createServiceSupabaseClient } from "@/lib/supabase/service";

export default async function TripLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tripId: string }>;
}) {
  const { tripId } = await params;
  const supabase = createServiceSupabaseClient();
  const { data: trip } = await supabase.from("trips").select("name").eq("id", tripId).single();
  if (!trip) notFound();

  return (
    // h-dvh, not min-h-dvh: this shell has real internal scroll regions
    // (chat feed, Plan's sections) with the tab bar pinned below them.
    // min-height only sets a floor, so once content grew taller than the
    // viewport the whole page scrolled — tab bar included — instead of just
    // the region meant to scroll. A fixed height forces every flex-1 child
    // in this chain to a definite height, so overflow is contained where
    // each page already puts its own overflow-y-auto.
    <div className="h-dvh flex flex-col bg-paper md:flex-row">
      <SidebarNav tripId={tripId} tripName={trip.name} />
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col overflow-hidden md:max-w-2xl">
        {/* The only way back to /trips used to be the phone's back button —
            this is the fix for that. Desktop gets the equivalent in SidebarNav. */}
        <div className="flex items-center gap-1.5 border-b border-line bg-card px-3 py-3 md:hidden">
          <Link
            href="/trips"
            aria-label="Back to your trips"
            className="-ml-1 rounded-full p-1.5 transition-colors active:bg-sunk"
          >
            <ChevronLeft className="size-5" />
          </Link>
          <span className="font-display text-base font-semibold truncate">{trip.name}</span>
        </div>
        <div className="flex-1 flex flex-col overflow-hidden animate-in fade-in duration-200">{children}</div>
        <TabBar tripId={tripId} />
      </div>
    </div>
  );
}
