"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { SendHorizontal } from "lucide-react";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { Avatar } from "@/components/caravan/avatar";
import type { MemberRow, MessageRow } from "@/lib/database.types";

export function RoomFeed({
  tripId,
  initialMessages,
  members,
  myMemberId,
}: {
  tripId: string;
  initialMessages: MessageRow[];
  members: MemberRow[];
  myMemberId: string;
}) {
  const [messages, setMessages] = useState<MessageRow[]>(initialMessages);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const feedRef = useRef<HTMLDivElement>(null);

  const memberByIdx = useMemo(() => {
    const map = new Map<string, { name: string; colorIndex: number }>();
    members.forEach((m, i) => map.set(m.id, { name: m.display_name, colorIndex: i }));
    return map;
  }, [members]);

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    // Broadcast, not postgres_changes: members authenticate via a custom JWT
    // (spec §10), not Supabase Auth, so they have no auth.uid() and
    // postgres_changes' RLS-gated realtime never reaches them — only the
    // admin would see live messages. The server broadcasts the exact row on
    // this channel after every insert (see lib/realtime/broadcast), so both
    // audiences append it the same way. Thread traffic uses a different
    // payload type, so it's naturally excluded here.
    const channel = supabase
      .channel(`trip:${tripId}`)
      .on("broadcast", { event: "change" }, ({ payload }) => {
        if (payload?.type === "message") {
          setMessages((cur) => [...cur, payload.message as MessageRow]);
        }
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [tripId]);

  useEffect(() => {
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  async function send() {
    const body = draft.trim();
    if (!body || sending) return;
    setDraft("");
    setSending(true);
    await fetch(`/api/trips/${tripId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    });
    setSending(false);
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div ref={feedRef} className="flex-1 overflow-y-auto px-4 pt-4 pb-3 flex flex-col gap-3.5">
        {messages.length === 0 && (
          <div className="bg-sunk rounded-lg p-4 text-sm text-ink-2">Trip started &mdash; say hello.</div>
        )}
        {messages.map((m) => {
          if (m.author_type === "agent") {
            return (
              <div
                key={m.id}
                className="animate-in fade-in slide-in-from-bottom-1 duration-300 border-l-[2.5px] border-agent bg-agent-t rounded-r-2xl px-3.5 py-3 flex flex-col gap-1.5 max-w-[300px] md:max-w-[460px]"
              >
                <span className="font-mono text-[11px] font-semibold tracking-wide text-agent uppercase">
                  {m.agent_name}
                </span>
                <span className="text-sm text-ink">{m.body}</span>
              </div>
            );
          }

          const isMine = m.author_id === myMemberId;
          const sender = m.author_id ? memberByIdx.get(m.author_id) : undefined;

          if (isMine) {
            return (
              <div key={m.id} className="animate-in fade-in slide-in-from-bottom-1 duration-300 self-end flex gap-2">
                <div className="bg-plum text-white rounded-[15px_4px_15px_15px] px-3.5 py-2.5 max-w-[262px] md:max-w-[420px]">
                  <div className="text-sm">{m.body}</div>
                </div>
              </div>
            );
          }

          return (
            <div key={m.id} className="animate-in fade-in slide-in-from-bottom-1 duration-300 flex gap-2">
              <Avatar name={sender?.name ?? "?"} colorIndex={sender?.colorIndex ?? 0} size="sm" />
              <div className="flex flex-col gap-0.5 min-w-0">
                <span className="text-[11px] font-medium text-ink-3 px-0.5">{sender?.name ?? "Someone"}</span>
                <div className="bg-card rounded-[4px_15px_15px_15px] px-3.5 py-2.5 max-w-[262px] md:max-w-[420px]">
                  <div className="text-sm">{m.body}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="border-t border-line bg-card px-3.5 py-2.5 pb-5 flex gap-2.5 items-center">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Say something"
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
