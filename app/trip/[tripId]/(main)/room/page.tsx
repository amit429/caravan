import { notFound } from "next/navigation";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { RoomFeed } from "./room-feed";

export default async function RoomPage({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  const supabase = createServiceSupabaseClient();
  const { data: trip } = await supabase.from("trips").select().eq("id", tripId).single();
  if (!trip) notFound();

  const { data: messages } = await supabase
    .from("messages")
    .select()
    .eq("trip_id", tripId)
    .order("created_at", { ascending: true });

  return <RoomFeed tripId={tripId} tripName={trip.name} initialMessages={messages ?? []} />;
}
