"use client";
import { useEffect, useRef, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import type { MessageRow } from "@/lib/database.types";

export function RoomFeed({
  tripId,
  tripName,
  initialMessages,
}: {
  tripId: string;
  tripName: string;
  initialMessages: MessageRow[];
}) {
  const [messages, setMessages] = useState<MessageRow[]>(initialMessages);
  const [draft, setDraft] = useState("");
  const feedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    const channel = supabase
      .channel(`room:${tripId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `trip_id=eq.${tripId}` },
        (payload) => setMessages((cur) => [...cur, payload.new as MessageRow])
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [tripId]);

  useEffect(() => {
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight });
  }, [messages.length]);

  async function send() {
    const body = draft.trim();
    if (!body) return;
    setDraft("");
    await fetch(`/api/trips/${tripId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    });
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex items-center gap-3 px-5 pt-1 pb-3">
        <h3 className="font-display text-lg font-semibold tracking-tight">{tripName}</h3>
      </div>
      <div ref={feedRef} className="flex-1 overflow-y-auto px-4 pb-3 flex flex-col gap-3.5">
        {messages.length === 0 && (
          <div className="bg-sunk rounded-lg p-4 text-sm text-ink-2">Trip started &mdash; say hello.</div>
        )}
        {messages.map((m) =>
          m.author_type === "agent" ? (
            <div
              key={m.id}
              className="border-l-[2.5px] border-agent bg-agent-t rounded-r-2xl px-3.5 py-3 flex flex-col gap-1.5 max-w-[300px] md:max-w-[460px]"
            >
              <span className="font-mono text-[11px] font-semibold tracking-wide text-agent uppercase">
                {m.agent_name}
              </span>
              <span className="text-sm text-ink">{m.body}</span>
            </div>
          ) : (
            <div key={m.id} className="flex gap-2">
              <div className="bg-card rounded-[4px_15px_15px_15px] px-3.5 py-2.5 max-w-[262px] md:max-w-[420px]">
                <div className="text-sm">{m.body}</div>
              </div>
            </div>
          )
        )}
      </div>
      <div className="border-t border-line bg-card px-3.5 py-2.5 pb-5 flex gap-2.5 items-center">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Say something"
          className="flex-1 bg-sunk rounded-full px-4 py-2.5 text-sm"
        />
        <button
          onClick={send}
          className="size-9 rounded-full bg-plum text-white grid place-items-center"
          aria-label="Send"
        >
          &uarr;
        </button>
      </div>
    </div>
  );
}
