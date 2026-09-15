import { notFound } from "next/navigation";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { resolveCaller } from "@/lib/auth/resolve-caller";
import { getAdminUser } from "@/lib/auth/session";
import { RoomFeed } from "./room-feed";
import type { MemberRow } from "@/lib/database.types";

export default async function RoomPage({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  const supabase = createServiceSupabaseClient();
  const caller = await resolveCaller(tripId, supabase);
  if (!caller || caller.status === "removed") notFound();

  const [{ data: messages }, { data: members }, admin] = await Promise.all([
    supabase.from("messages").select().eq("trip_id", tripId).eq("lane", "group").order("created_at", { ascending: true }),
    supabase.from("members").select().eq("trip_id", tripId).eq("status", "active").order("joined_at", { ascending: true }),
    getAdminUser(),
  ]);

  return (
    <RoomFeed
      tripId={tripId}
      initialMessages={messages ?? []}
      members={(members ?? []) as MemberRow[]}
      myMemberId={caller.id}
      isAdmin={!!admin}
    />
  );
}
