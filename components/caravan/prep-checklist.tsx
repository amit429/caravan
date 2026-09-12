"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { TaskRow } from "@/lib/database.types";

function formatDue(dueDate: string | null) {
  if (!dueDate) return null;
  return new Date(`${dueDate}T00:00:00Z`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function TaskRowItem({ tripId, task, canToggle }: { tripId: string; task: TaskRow; canToggle: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function toggle() {
    if (!canToggle || pending) return;
    setPending(true);
    await fetch(`/api/trips/${tripId}/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ done: !task.done }),
    });
    setPending(false);
    router.refresh();
  }

  const due = formatDue(task.due_date);
  return (
    <div className="flex items-center gap-2.5 px-3.5 py-2.5">
      <button
        onClick={toggle}
        disabled={!canToggle}
        className={`h-5 w-5 shrink-0 rounded-full border-2 ${
          task.done ? "border-signal-d bg-signal-d" : "border-line"
        } ${canToggle ? "" : "opacity-50"}`}
        aria-label={task.done ? "Mark not done" : "Mark done"}
      />
      <span className={`flex-1 text-sm ${task.done ? "text-ink-3 line-through" : ""}`}>{task.title}</span>
      {due && <span className="text-[10px] font-mono text-ink-3">by {due}</span>}
    </div>
  );
}

export function PrepChecklist({
  tripId,
  yourTasks,
  groupTasks,
}: {
  tripId: string;
  yourTasks: TaskRow[];
  groupTasks: TaskRow[];
}) {
  const total = yourTasks.length + groupTasks.length;
  const done = yourTasks.filter((t) => t.done).length + groupTasks.filter((t) => t.done).length;

  return (
    <div className="flex flex-col gap-3">
      {total > 0 && (
        <div className="flex items-center gap-2 text-xs text-ink-3">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-sunk">
            <div className="h-full rounded-full bg-signal-d" style={{ width: `${(done / total) * 100}%` }} />
          </div>
          <span>
            {done}/{total}
          </span>
        </div>
      )}
      {yourTasks.length > 0 && (
        <div className="flex flex-col gap-1">
          <h4 className="px-0.5 text-[10px] font-mono text-ink-3">YOURS</h4>
          <div className="divide-y divide-line rounded-lg bg-card">
            {yourTasks.map((t) => (
              <TaskRowItem key={t.id} tripId={tripId} task={t} canToggle />
            ))}
          </div>
        </div>
      )}
      {groupTasks.length > 0 && (
        <div className="flex flex-col gap-1">
          <h4 className="px-0.5 text-[10px] font-mono text-ink-3">GROUP</h4>
          <div className="divide-y divide-line rounded-lg bg-card">
            {groupTasks.map((t) => (
              <TaskRowItem key={t.id} tripId={tripId} task={t} canToggle />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
