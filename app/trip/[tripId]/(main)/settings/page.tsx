import { notFound } from "next/navigation";
import { getAuthUser } from "@/lib/auth/session";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { DECISION_TYPE_TITLE } from "@/lib/decisions/decision-titles";
import { ToggleJoiningButton } from "@/components/caravan/settings/toggle-joining-button";
import { TripDurationButtons } from "@/components/caravan/settings/trip-duration-buttons";
import { ReopenDecisionButton } from "@/components/caravan/decisions/reopen-decision-button";
import { RemoveMemberButton } from "@/components/caravan/settings/remove-member-button";
import { InviteLinkCard } from "@/components/caravan/sharing/invite-link-card";
import { DeleteTripButton } from "@/components/caravan/settings/delete-trip-button";
import { Avatar } from "@/components/caravan/primitives/avatar";
import type { DecisionRow, MemberRow } from "@/lib/database.types";

const TONE_LABEL: Record<string, string> = {
  efficient: "Efficient — short, no jokes, gets to the point.",
  warm: "Warm — friendly, a little chatty.",
  dry: "Dry — funny, slightly mouthy.",
};

export default async function TripSettingsPage({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  const admin = await getAuthUser();
  if (!admin) notFound();

  const supabase = createServiceSupabaseClient();
  const { data: trip } = await supabase.from("trips").select().eq("id", tripId).single();
  if (!trip || trip.admin_user_id !== admin.id) notFound();

  const [{ data: lockedDecisions }, { data: members }] = await Promise.all([
    supabase.from("decisions").select().eq("trip_id", tripId).eq("state", "LOCKED").order("created_at", { ascending: false }),
    supabase.from("members").select().eq("trip_id", tripId).eq("status", "active").order("joined_at", { ascending: true }),
  ]);

  const activeMembers = (members ?? []) as MemberRow[];

  return (
    <div className="flex-1 flex flex-col gap-4 overflow-y-auto px-5 pb-8 pt-5 md:px-8">
      <section className="flex flex-col gap-2">
        <h3 className="font-mono text-xs text-ink-3">TRIP</h3>
        <div className="divide-y divide-line rounded-lg bg-card">
          <div className="flex items-center gap-3 px-3.5 py-3">
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium">Joining</div>
              <div className="mt-0.5 truncate text-xs text-ink-3">{trip.joining_open ? "Open" : "Closed"}</div>
            </div>
            <ToggleJoiningButton tripId={tripId} joiningOpen={trip.joining_open} />
          </div>
          {trip.joining_open && <InviteLinkCard inviteCode={trip.invite_code} />}
          <div className="flex items-center gap-3 px-3.5 py-3">
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium">Agent tone</div>
              <div className="mt-0.5 text-xs text-ink-3">{TONE_LABEL[trip.agent_tone] ?? trip.agent_tone}</div>
            </div>
          </div>
          <div className="flex flex-col gap-2 px-3.5 py-3">
            <div>
              <div className="text-sm font-medium">Trip duration</div>
              <div className="mt-0.5 text-xs text-ink-3">
                Used to prioritize date options — changing this refreshes any open vote.
              </div>
            </div>
            <TripDurationButtons tripId={tripId} preferredTripDays={trip.preferred_trip_days} />
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="font-mono text-xs text-ink-3">MEMBERS</h3>
        <div className="divide-y divide-line rounded-lg bg-card">
          {activeMembers.map((m, i) => (
            <div key={m.id} className="flex items-center gap-3 px-3.5 py-3">
              <Avatar name={m.display_name} colorIndex={i} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{m.display_name}</div>
                <div className="truncate text-xs text-ink-3">{m.role === "admin" ? "Admin" : m.email}</div>
              </div>
              {m.role !== "admin" && <RemoveMemberButton tripId={tripId} memberId={m.id} memberName={m.display_name} />}
            </div>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="font-mono text-xs text-ink-3">LOCKED DECISIONS</h3>
        {lockedDecisions && lockedDecisions.length > 0 ? (
          <div className="divide-y divide-line rounded-lg bg-card">
            {(lockedDecisions as DecisionRow[]).map((d) => {
              const label = d.options.find((o) => o.id === d.locked_option)?.label ?? d.locked_option;
              return (
                <div key={d.id} className="flex items-center gap-3 px-3.5 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">{DECISION_TYPE_TITLE[d.type] ?? d.type}</div>
                    <div className="mt-0.5 truncate text-xs text-ink-3">{label}</div>
                  </div>
                  <ReopenDecisionButton tripId={tripId} decisionId={d.id} />
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-lg bg-sunk p-4 text-sm text-ink-2">Nothing locked yet.</div>
        )}
      </section>

      <p className="text-xs text-ink-3">
        Every override here posts to the room, with your name on it — nothing happens silently.
      </p>

      <section className="flex flex-col gap-2 pt-2">
        <h3 className="font-mono text-xs text-stop">DANGER ZONE</h3>
        <DeleteTripButton tripId={tripId} tripName={trip.name} />
      </section>
    </div>
  );
}
