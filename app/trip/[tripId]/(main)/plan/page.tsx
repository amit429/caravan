import { notFound } from "next/navigation";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { resolveCaller } from "@/lib/auth/resolve-caller";
import { getAdminUser } from "@/lib/auth/session";
import { computeTopDateWindows } from "@/lib/date-solver";
import { groupBudgetCeiling } from "@/lib/budget";
import { MapRouteIllustration } from "@/components/caravan/illustrations";
import { Avatar } from "@/components/caravan/avatar";
import { DecisionCard } from "@/components/caravan/decision-card";
import { CreateDatesDecisionButton } from "@/components/caravan/create-dates-decision-button";
import { GenerateDestinationsButton } from "@/components/caravan/generate-destinations-button";
import { GenerateItineraryButton } from "@/components/caravan/generate-itinerary-button";
import { PrepChecklist } from "@/components/caravan/prep-checklist";
import { GenerateChecklistButton } from "@/components/caravan/generate-checklist-button";
import { ShareSnapshot } from "@/components/caravan/share-snapshot";
import { RealtimeRefresh } from "@/components/caravan/realtime-refresh";
import { FactsList } from "@/components/caravan/facts-list";
import { SummaryLinkCard } from "@/components/caravan/summary-link-card";
import type {
  AvailabilityRow,
  BookingRow,
  CostEstimateRow,
  DecisionRow,
  FactRow,
  IdeaRow,
  ItineraryRow,
  MemberRow,
  TaskRow,
  TripRow,
  VoteRow,
} from "@/lib/database.types";

function formatRange(start: string, end: string) {
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", timeZone: "UTC" };
  const s = new Date(`${start}T00:00:00Z`).toLocaleDateString(undefined, opts);
  const e = new Date(`${end}T00:00:00Z`).toLocaleDateString(undefined, opts);
  return `${s} – ${e}`;
}

export default async function PlanPage({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  const supabase = createServiceSupabaseClient();
  const caller = await resolveCaller(tripId, supabase);
  if (!caller || caller.status === "removed") notFound();

  const [
    { data: trip },
    { data: members },
    { data: facts },
    { data: availability },
    { data: decisions },
    { data: itinerary },
    { data: ideas },
    { data: tasks },
    { data: bookings },
    { data: costEstimate },
  ] = await Promise.all([
    supabase.from("trips").select().eq("id", tripId).single(),
    supabase.from("members").select().eq("trip_id", tripId).eq("status", "active"),
    supabase.from("facts").select().eq("trip_id", tripId).is("superseded_by", null),
    supabase.from("availability").select().eq("trip_id", tripId),
    supabase.from("decisions").select().eq("trip_id", tripId).order("created_at", { ascending: false }),
    supabase.from("itineraries").select().eq("trip_id", tripId).maybeSingle(),
    supabase.from("ideas").select().eq("trip_id", tripId).order("created_at", { ascending: false }),
    supabase.from("tasks").select().eq("trip_id", tripId),
    supabase.from("bookings").select().eq("trip_id", tripId).order("created_at", { ascending: false }),
    supabase.from("cost_estimates").select().eq("trip_id", tripId).maybeSingle(),
  ]);

  const activeMembers = (members ?? []) as MemberRow[];
  const allFacts = (facts ?? []) as FactRow[];
  const allAvailability = (availability ?? []) as AvailabilityRow[];
  const allDecisions = (decisions ?? []) as DecisionRow[];
  const tripItinerary = itinerary as ItineraryRow | null;
  const allIdeas = (ideas ?? []) as IdeaRow[];
  const allTasks = (tasks ?? []) as TaskRow[];
  const allBookings = (bookings ?? []) as BookingRow[];
  const tripCostEstimate = costEstimate as CostEstimateRow | null;
  const tripRow = trip as TripRow;

  const decisionIds = allDecisions.map((d) => d.id);
  const { data: votesData } = decisionIds.length
    ? await supabase.from("votes").select().in("decision_id", decisionIds)
    : { data: [] as VoteRow[] };
  const votesByDecision = new Map<string, VoteRow[]>();
  for (const v of (votesData ?? []) as VoteRow[]) {
    const list = votesByDecision.get(v.decision_id) ?? [];
    list.push(v);
    votesByDecision.set(v.decision_id, list);
  }

  const isAdmin = !!(await getAdminUser());
  const membersWithIntake = new Set(allFacts.map((f) => f.member_id));
  const dateWindows = computeTopDateWindows(
    allAvailability,
    activeMembers.map((m) => m.id)
  );
  const budgetBands = allFacts.filter((f) => f.category === "budget").map((f) => (f.value as { band: string }).band);
  const groupCeiling = groupBudgetCeiling(budgetBands);
  const hasDatesDecision = allDecisions.some((d) => d.type === "DATES");
  const hasDestinationDecision = allDecisions.some((d) => d.type === "DESTINATION");
  const lockedDestinationDecision = allDecisions.find((d) => d.type === "DESTINATION" && d.state === "LOCKED");
  const lockedDatesDecision = allDecisions.find((d) => d.type === "DATES" && d.state === "LOCKED");
  const hasLockedDestination = !!lockedDestinationDecision;
  const hasLockedDates = !!lockedDatesDecision;
  const destinationLabel =
    lockedDestinationDecision?.options.find((o) => o.id === lockedDestinationDecision.locked_option)?.label ?? null;
  const datesLabel =
    lockedDatesDecision?.options.find((o) => o.id === lockedDatesDecision.locked_option)?.label ?? null;

  const yourTasks = allTasks.filter((t) => t.member_id === caller.id);
  const groupTasks = allTasks.filter((t) => t.member_id === null);
  const checklistTotal = allTasks.length;
  const checklistDone = allTasks.filter((t) => t.done).length;

  const openItems: string[] = [];
  const waitingOnIntake = activeMembers.length - membersWithIntake.size;
  if (waitingOnIntake > 0) {
    openItems.push(`${waitingOnIntake} of ${activeMembers.length} haven't answered the 5 questions yet`);
  }
  if (dateWindows.length > 0 && !hasDatesDecision) {
    openItems.push("Dates haven't been put to a vote yet");
  }

  const nothingYet = allFacts.length === 0 && allDecisions.length === 0;

  // Budget is never listed individually anywhere, even here — only the
  // aggregated group ceiling above is ever shown (spec: "individual budgets
  // are never shown here, to anyone, including the admin").
  const shareableFacts = allFacts.filter((f) => f.category !== "budget");
  const memberNames = new Map(activeMembers.map((m, i) => [m.id, { name: m.display_name, colorIndex: i }]));

  return (
    <div className="flex-1 flex flex-col gap-4 overflow-y-auto px-5 pb-8 pt-5 md:px-8">
      <RealtimeRefresh tripId={tripId} />
      <section className="flex flex-col gap-2">
        <h3 className="font-mono text-xs text-ink-3">SHARE</h3>
        <ShareSnapshot
          tripName={tripRow.name}
          destinationLabel={destinationLabel}
          datesLabel={datesLabel}
          groupCeiling={groupCeiling}
          checklist={checklistTotal > 0 ? { done: checklistDone, total: checklistTotal } : null}
          inviteCode={tripRow.invite_code}
        />
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="font-mono text-xs text-ink-3">PARTY</h3>
        <div className="divide-y divide-line rounded-lg bg-card">
          {activeMembers.map((m, i) => (
            <div key={m.id} className="flex items-center gap-2.5 px-3.5 py-2.5">
              <Avatar name={m.display_name} colorIndex={i} size="sm" />
              <span className="flex-1 text-sm font-medium">{m.display_name}</span>
              <span
                className={`rounded-full px-2 py-1 text-[10px] font-semibold ${
                  membersWithIntake.has(m.id)
                    ? "bg-agent-t text-agent"
                    : m.flagged_at
                      ? "bg-stop-t text-stop"
                      : m.nudge_tier > 0
                        ? "bg-warn-t text-warn"
                        : "bg-sunk text-ink-3"
                }`}
              >
                {membersWithIntake.has(m.id)
                  ? "answered"
                  : m.flagged_at
                    ? "flagged"
                    : m.nudge_tier > 0
                      ? "nudged"
                      : "waiting"}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="font-mono text-xs text-ink-3">DATES</h3>
        {dateWindows.length === 0 ? (
          <div className="rounded-lg bg-sunk p-4 text-sm text-ink-2">Nobody&rsquo;s shared their dates yet.</div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-line bg-card">
            {dateWindows.map((w, i) => (
              <div key={i} className="border-t border-line px-3.5 py-2.5 first:border-t-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">{formatRange(w.startDate, w.endDate)}</span>
                  <span className="ml-auto text-xs text-ink-3">
                    {w.membersIn.length + w.membersPartial.length}/{activeMembers.length} in
                  </span>
                </div>
              </div>
            ))}
            {isAdmin && !hasDatesDecision && (
              <div className="border-t border-line px-3.5 py-2.5">
                <CreateDatesDecisionButton tripId={tripId} windows={dateWindows} />
              </div>
            )}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="font-mono text-xs text-ink-3">BUDGET</h3>
        <div className="rounded-lg bg-card p-3.5">
          {groupCeiling ? (
            <p className="text-sm">
              Plan needs to land under <span className="font-semibold">&#8377;{groupCeiling.toLocaleString("en-IN")}</span> a
              head.
            </p>
          ) : (
            <p className="text-sm text-ink-2">No budgets shared yet.</p>
          )}
        </div>
      </section>

      {shareableFacts.length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className="font-mono text-xs text-ink-3">FACTS</h3>
          <FactsList tripId={tripId} facts={shareableFacts} memberNames={memberNames} myMemberId={caller.id} />
        </section>
      )}

      {!hasDestinationDecision && (
        <section className="flex flex-col gap-2">
          <h3 className="font-mono text-xs text-ink-3">DESTINATION</h3>
          {isAdmin ? (
            <div className="rounded-lg bg-card p-3.5">
              <GenerateDestinationsButton tripId={tripId} />
            </div>
          ) : (
            <div className="rounded-lg bg-sunk p-4 text-sm text-ink-2">Nobody&rsquo;s put together options yet.</div>
          )}
        </section>
      )}

      {allDecisions.length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className="font-mono text-xs text-ink-3">DECISIONS</h3>
          <div className="flex flex-col gap-3">
            {allDecisions.map((d) => (
              <DecisionCard key={d.id} tripId={tripId} decision={d} votes={votesByDecision.get(d.id) ?? []} isAdmin={isAdmin} />
            ))}
          </div>
        </section>
      )}

      {hasLockedDestination && (
        <section className="flex flex-col gap-2">
          <h3 className="font-mono text-xs text-ink-3">ITINERARY</h3>
          {tripItinerary ? (
            <div className="flex flex-col gap-3">
              {isAdmin && (
                <div className="self-start rounded-lg bg-card px-3.5 py-2">
                  <GenerateItineraryButton tripId={tripId} label="Regenerate itinerary" />
                </div>
              )}
              <div className="flex flex-col gap-3">
                {tripItinerary.days.map((day) => (
                  <div key={day.day} className="overflow-hidden rounded-lg border border-line bg-card">
                    <div className="border-b border-line bg-sunk px-3.5 py-2">
                      <span className="text-sm font-semibold">
                        Day {day.day}: {day.title}
                      </span>
                    </div>
                    <div className="divide-y divide-line">
                      {day.activities.map((a, i) => (
                        <div key={i} className="flex gap-3 px-3.5 py-2.5">
                          <span className="w-16 shrink-0 text-xs font-medium text-ink-3">{a.time}</span>
                          <span className="text-sm">{a.description}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : isAdmin ? (
            <div className="rounded-lg bg-card p-3.5">
              <GenerateItineraryButton tripId={tripId} label="Generate itinerary" />
            </div>
          ) : (
            <div className="rounded-lg bg-sunk p-4 text-sm text-ink-2">No itinerary yet.</div>
          )}
        </section>
      )}

      {(hasLockedDestination || tripCostEstimate) && (
        <SummaryLinkCard
          href={`/trip/${tripId}/cost`}
          label="COST"
          title={
            tripCostEstimate
              ? `₹${tripCostEstimate.min_per_head.toLocaleString("en-IN")}–${tripCostEstimate.max_per_head.toLocaleString("en-IN")} a head`
              : "No estimate yet"
          }
          subtitle={tripCostEstimate ? `for ${tripCostEstimate.destination}` : "Estimate what it'll cost"}
        />
      )}

      {hasLockedDestination && hasLockedDates && (
        <section className="flex flex-col gap-2">
          <h3 className="font-mono text-xs text-ink-3">PREP CHECKLIST</h3>
          {allTasks.length > 0 ? (
            <PrepChecklist tripId={tripId} yourTasks={yourTasks} groupTasks={groupTasks} />
          ) : isAdmin ? (
            <div className="rounded-lg bg-card p-3.5">
              <GenerateChecklistButton tripId={tripId} />
            </div>
          ) : (
            <div className="rounded-lg bg-sunk p-4 text-sm text-ink-2">No checklist yet.</div>
          )}
        </section>
      )}

      <SummaryLinkCard
        href={`/trip/${tripId}/bookings`}
        label="BOOKINGS"
        title={allBookings.length > 0 ? `${allBookings.length} being tracked` : "Nothing tracked yet"}
        subtitle="Who's booked what"
      />

      <SummaryLinkCard
        href={`/trip/${tripId}/ideas`}
        label="IDEAS"
        title={allIdeas.length > 0 ? `${allIdeas.length} dropped` : "No ideas yet"}
        subtitle="Places people pasted in"
      />

      {openItems.length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className="font-mono text-xs text-ink-3">OPEN ITEMS</h3>
          <div className="divide-y divide-line rounded-lg bg-card">
            {openItems.map((item, i) => (
              <p key={i} className="px-3.5 py-2.5 text-sm">
                {item}
              </p>
            ))}
          </div>
        </section>
      )}

      {nothingYet && (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 py-6 text-center">
          <MapRouteIllustration className="text-agent" />
          <p className="max-w-[260px] text-sm text-ink-2">
            Once the group starts answering, dates, budget, and decisions will show up here.
          </p>
        </div>
      )}
    </div>
  );
}
