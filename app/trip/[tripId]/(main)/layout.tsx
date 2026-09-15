import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Settings } from "lucide-react";
import { TabBar } from "@/components/caravan/tab-bar";
import { SidebarNav } from "@/components/caravan/sidebar-nav";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { getAuthUser } from "@/lib/auth/session";

export default async function TripLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tripId: string }>;
}) {
  const { tripId } = await params;
  const supabase = createServiceSupabaseClient();
  const [{ data: trip }, admin] = await Promise.all([
    supabase.from("trips").select("name, admin_user_id").eq("id", tripId).single(),
    getAuthUser(),
  ]);
  if (!trip) notFound();
  const isOwningAdmin = !!admin && trip.admin_user_id === admin.id;

  return (
    // h-dvh, not min-h-dvh: this shell has real internal scroll regions
    // (chat feed, Plan's sections) with the tab bar pinned below them.
    // min-height only sets a floor, so once content grew taller than the
    // viewport the whole page scrolled — tab bar included — instead of just
    // the region meant to scroll. A fixed height forces every flex-1 child
    // in this chain to a definite height, so overflow is contained where
    // each page already puts its own overflow-y-auto.
    <div className="h-dvh flex flex-col bg-paper md:flex-row">
      <SidebarNav tripId={tripId} tripName={trip.name} isAdmin={isOwningAdmin} />
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
          <span className="flex-1 truncate font-display text-base font-semibold">{trip.name}</span>
          {isOwningAdmin && (
            <Link
              href={`/trip/${tripId}/settings`}
              aria-label="Trip settings"
              className="rounded-full p-1.5 text-ink-2 transition-colors active:bg-sunk"
            >
              <Settings className="size-5" />
            </Link>
          )}
        </div>
        <div className="flex-1 flex flex-col overflow-hidden animate-in fade-in duration-200">{children}</div>
        <TabBar tripId={tripId} />
      </div>
    </div>
  );
}
