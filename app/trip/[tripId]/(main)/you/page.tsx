import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, CircleDashed, ChevronRight } from "lucide-react";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { resolveCaller } from "@/lib/auth/resolve-caller";
import { loadThread } from "@/lib/threads/load-thread";
import { ThreadFeed } from "@/components/caravan/thread-feed";
import { RealtimeRefresh } from "@/components/caravan/realtime-refresh";
import type { TaskRow } from "@/lib/database.types";

export default async function YouPage({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  const supabase = createServiceSupabaseClient();
  const caller = await resolveCaller(tripId, supabase);
  if (!caller || caller.status === "removed") notFound();

  const [{ count: factCount }, { data: yourTasks }] = await Promise.all([
    supabase.from("facts").select("*", { count: "exact", head: true }).eq("trip_id", tripId).eq("member_id", caller.id),
    supabase.from("tasks").select().eq("trip_id", tripId).eq("member_id", caller.id),
  ]);
  const intakeDone = (factCount ?? 0) > 0;
  const pendingTasks = ((yourTasks ?? []) as TaskRow[]).filter((t) => !t.done).length;

  const { threadId, messages } = await loadThread(tripId, caller.id, supabase);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <RealtimeRefresh tripId={tripId} />
      <div className="flex flex-col gap-2 px-4 pt-3">
        <div className="flex items-center gap-2.5 rounded-lg bg-card px-3.5 py-2.5">
          {intakeDone ? (
            <CheckCircle2 className="size-4 shrink-0 text-agent" />
          ) : (
            <CircleDashed className="size-4 shrink-0 text-ink-3" />
          )}
          <span className="flex-1 text-sm font-medium">
            {intakeDone ? "Your answers are in" : "Five quick questions to go"}
          </span>
          <Link href={`/trip/${tripId}/intake`} className="text-sm font-medium text-plum">
            {intakeDone ? "Edit" : "Answer"}
          </Link>
        </div>
        {pendingTasks > 0 && (
          <Link
            href={`/trip/${tripId}/plan`}
            className="flex items-center gap-2.5 rounded-lg bg-card px-3.5 py-2.5 transition-colors hover:bg-sunk"
          >
            <CircleDashed className="size-4 shrink-0 text-warn" />
            <span className="flex-1 text-sm font-medium">
              {pendingTasks} prep {pendingTasks === 1 ? "task" : "tasks"} still open
            </span>
            <ChevronRight className="size-4 shrink-0 text-ink-3" />
          </Link>
        )}
      </div>
      <ThreadFeed tripId={tripId} threadId={threadId} initialMessages={messages} intakeDone={intakeDone} />
    </div>
  );
}
