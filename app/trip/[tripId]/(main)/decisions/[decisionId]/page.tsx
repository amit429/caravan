import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { resolveCaller } from "@/lib/auth/resolve-caller";
import { DECISION_TYPE_TITLE } from "@/lib/decisions/decision-titles";
import { DecisionCard } from "@/components/caravan/decisions/decision-card";
import { Avatar } from "@/components/caravan/primitives/avatar";
import type { DecisionRow, MemberRow, VoteRow } from "@/lib/database.types";

export default async function DecisionDetailPage({
  params,
}: {
  params: Promise<{ tripId: string; decisionId: string }>;
}) {
  const { tripId, decisionId } = await params;
  const supabase = createServiceSupabaseClient();
  const caller = await resolveCaller(tripId, supabase);
  if (!caller || caller.status === "removed") notFound();

  const [{ data: decision }, { data: votes }, { data: members }] = await Promise.all([
    supabase.from("decisions").select().eq("id", decisionId).eq("trip_id", tripId).maybeSingle(),
    supabase.from("votes").select().eq("decision_id", decisionId),
    supabase.from("members").select().eq("trip_id", tripId).eq("status", "active").order("joined_at", { ascending: true }),
  ]);
  if (!decision) notFound();

  const isAdmin = caller.role === "admin";
  const decisionRow = decision as DecisionRow;
  const allVotes = (votes ?? []) as VoteRow[];
  const activeMembers = (members ?? []) as MemberRow[];
  const votedMemberIds = new Set(allVotes.map((v) => v.member_id));
  const notVoted = activeMembers.filter((m) => !votedMemberIds.has(m.id));

  return (
    <div className="flex-1 flex flex-col gap-4 overflow-y-auto px-5 pb-8 pt-3 md:px-8">
      <div className="flex items-center gap-2">
        <Link href={`/trip/${tripId}/plan`} aria-label="Back to Plan" className="-ml-1 rounded-full p-1.5 transition-colors active:bg-sunk">
          <ChevronLeft className="size-5" />
        </Link>
        <h1 className="font-display text-lg font-semibold">{DECISION_TYPE_TITLE[decisionRow.type] ?? decisionRow.type}</h1>
      </div>

      {decisionRow.state !== "LOCKED" ? (
        <div className="rounded-2xl bg-ink p-4 text-paper">
          {decisionRow.deadline && (
            <span className="font-mono text-[11px] font-semibold text-signal">
              CLOSES {new Date(decisionRow.deadline).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).toUpperCase()}
            </span>
          )}
          <p className="mt-1.5 text-sm text-paper/75">
            When the deadline passes, whatever has the most votes gets locked automatically. Anyone who hasn&rsquo;t
            voted gets nudged first — silence never counts as a yes.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl bg-ink p-4 text-paper">
          <span className="font-mono text-[11px] font-semibold text-signal">LOCKED</span>
          {decisionRow.rationale && <p className="mt-1.5 text-sm text-paper/75">{decisionRow.rationale}</p>}
        </div>
      )}

      <DecisionCard
        tripId={tripId}
        decision={decisionRow}
        votes={allVotes}
        isAdmin={isAdmin}
        showDetailLink={false}
        redirectOnDeleteTo={`/trip/${tripId}/plan`}
      />

      {notVoted.length > 0 && decisionRow.state !== "LOCKED" && (
        <div className="flex flex-col gap-2">
          <h3 className="font-mono text-xs text-ink-3">HAVEN&rsquo;T VOTED</h3>
          <div className="divide-y divide-line rounded-lg bg-card">
            {notVoted.map((m, i) => (
              <div key={m.id} className="flex items-center gap-2.5 px-3.5 py-2.5">
                <Avatar name={m.display_name} colorIndex={activeMembers.indexOf(m)} size="xs" />
                <span className="text-sm">{m.display_name}</span>
                {m.nudge_tier > 0 && (
                  <span className="ml-auto text-[10px] font-semibold text-warn">nudged</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
