"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

// Re-runs the server component on any broadcast for this trip — cheaper to
// just refetch than to hand-roll per-table client-side state updates for a
// page with this many independent sections (party/dates/budget/decisions/
// itinerary/checklist/bookings/ideas). See lib/realtime/broadcast for why
// this uses broadcast rather than postgres_changes (RLS blocks members).
export function RealtimeRefresh({ tripId }: { tripId: string }) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    const channel = supabase
      .channel(`trip:${tripId}`)
      .on("broadcast", { event: "change" }, () => router.refresh())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [tripId, router]);

  return null;
}
