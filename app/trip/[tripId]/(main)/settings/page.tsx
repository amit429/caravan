import { notFound } from "next/navigation";
import { getAuthUser } from "@/lib/auth/session";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { DECISION_TYPE_TITLE } from "@/lib/decision-titles";
import { ToggleJoiningButton } from "@/components/caravan/toggle-joining-button";
import { ReopenDecisionButton } from "@/components/caravan/reopen-decision-button";
import type { DecisionRow } from "@/lib/database.types";

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

  const { data: lockedDecisions } = await supabase
    .from("decisions")
    .select()
    .eq("trip_id", tripId)
    .eq("state", "LOCKED")
    .order("created_at", { ascending: false });

  return (
    <div className="flex-1 flex flex-col gap-4 overflow-y-auto px-5 pb-8 pt-5 md:px-8">
      <section className="flex flex-col gap-2">
        <h3 className="font-mono text-xs text-ink-3">TRIP</h3>
        <div className="divide-y divide-line rounded-lg bg-card">
          <div className="flex items-center gap-3 px-3.5 py-3">
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium">Joining</div>
              <div className="mt-0.5 truncate text-xs text-ink-3">
                {trip.joining_open ? `Open — code ${trip.invite_code}` : "Closed"}
              </div>
            </div>
            <ToggleJoiningButton tripId={tripId} joiningOpen={trip.joining_open} />
          </div>
          <div className="flex items-center gap-3 px-3.5 py-3">
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium">Agent tone</div>
              <div className="mt-0.5 text-xs text-ink-3">{TONE_LABEL[trip.agent_tone] ?? trip.agent_tone}</div>
            </div>
          </div>
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
    </div>
  );
}
