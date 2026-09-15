"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { ListChecks, SendHorizontal } from "lucide-react";
import type { MessageRow } from "@/lib/database.types";

export function ThreadFeed({
  tripId,
  threadId,
  initialMessages,
  intakeDone,
}: {
  tripId: string;
  threadId: string;
  initialMessages: MessageRow[];
  intakeDone: boolean;
}) {
  const [messages, setMessages] = useState<MessageRow[]>(initialMessages);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const feedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    // Same broadcast mechanic as the group Room feed (see
    // lib/realtime/broadcast) — filtered to this specific thread so a
    // member never sees another thread's traffic, even in principle.
    const channel = supabase
      .channel(`trip:${tripId}`)
      .on("broadcast", { event: "change" }, ({ payload }) => {
        if (payload?.type === "thread_message" && payload.threadId === threadId) {
          setMessages((cur) => [...cur, payload.message as MessageRow]);
        }
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [tripId, threadId]);

  useEffect(() => {
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  async function send() {
    const body = draft.trim();
    if (!body || sending) return;
    setDraft("");
    setSending(true);
    await fetch(`/api/trips/${tripId}/thread`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    });
    setSending(false);
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div ref={feedRef} className="flex-1 overflow-y-auto px-4 pt-4 pb-3 flex flex-col gap-3">
        {messages.map((m) =>
          m.author_type === "agent" ? (
            <div
              key={m.id}
              className="animate-in fade-in slide-in-from-bottom-1 duration-300 self-start max-w-[280px] md:max-w-[420px] border-l-[2.5px] border-agent bg-agent-t rounded-r-2xl rounded-bl-2xl px-3.5 py-3 flex flex-col gap-1"
            >
              <span className="font-mono text-[10.5px] font-semibold tracking-wide text-agent uppercase">
                {m.agent_name ?? "concierge"}
              </span>
              <span className="text-sm text-ink">{m.body}</span>
            </div>
          ) : (
            <div
              key={m.id}
              className="animate-in fade-in slide-in-from-bottom-1 duration-300 self-end max-w-[262px] md:max-w-[420px] bg-plum text-white rounded-[15px_4px_15px_15px] px-3.5 py-2.5"
            >
              <span className="text-sm">{m.body}</span>
            </div>
          )
        )}
        {!intakeDone && (
          <Link
            href={`/trip/${tripId}/intake`}
            className="animate-in fade-in slide-in-from-bottom-1 duration-300 self-start flex items-center gap-2.5 max-w-[280px] md:max-w-[420px] rounded-2xl border border-dashed border-line bg-card px-3.5 py-3 text-sm font-semibold text-plum transition-colors hover:bg-plum-t"
          >
            <ListChecks className="size-4 shrink-0" />
            Answer the five questions
          </Link>
        )}
      </div>
      <div className="border-t border-line bg-card px-3.5 py-2.5 pb-5 flex gap-2.5 items-center">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Tell it in your own words…"
          className="flex-1 bg-sunk rounded-full px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-plum/30"
        />
        <button
          onClick={send}
          disabled={sending || !draft.trim()}
          className="size-9 rounded-full bg-plum text-white grid place-items-center transition-transform active:scale-90 disabled:opacity-40"
          aria-label="Send"
        >
          <SendHorizontal className="size-4" />
        </button>
      </div>
    </div>
  );
}
