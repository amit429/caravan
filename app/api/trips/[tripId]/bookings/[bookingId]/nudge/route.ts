import { NextResponse } from "next/server";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { requireTripOwner } from "@/lib/auth/resolve-caller";
import { postAgentMessage } from "@/lib/agents/runtime/post-agent-message";
import { buildNudgeMessage } from "@/lib/bookings/nudge-message";
import type { MemberRow } from "@/lib/database.types";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ tripId: string; bookingId: string }> }
) {
  const { tripId, bookingId } = await params;
  const supabase = createServiceSupabaseClient();
  const owner = await requireTripOwner(tripId, supabase);
  if ("error" in owner) return owner.error;

  const { data: booking } = await supabase.from("bookings").select().eq("id", bookingId).eq("trip_id", tripId).single();
  if (!booking) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const [{ data: members }, { data: statuses }] = await Promise.all([
    supabase.from("members").select().eq("trip_id", tripId).eq("status", "active"),
    supabase.from("booking_status").select().eq("booking_id", bookingId),
  ]);

  const bookedMemberIds = new Set((statuses ?? []).filter((s) => s.booked).map((s) => s.member_id));
  const unbookedNames = ((members ?? []) as MemberRow[])
    .filter((m) => !bookedMemberIds.has(m.id))
    .map((m) => m.display_name);

  const message = buildNudgeMessage(booking.item, unbookedNames);
  if (message) {
    await postAgentMessage({ tripId, agentName: "quartermaster", body: message });
  }

  return NextResponse.json({ ok: true, nudged: unbookedNames });
}
