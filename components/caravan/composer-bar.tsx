"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, SendHorizontal, Link2, Vote, Sparkles, Trash2 } from "lucide-react";
import { BottomSheet } from "@/components/caravan/bottom-sheet";

type SheetView = "menu" | "link" | "vote" | "ask";

export function ComposerBar({ tripId, isAdmin }: { tripId: string; isAdmin: boolean }) {
  const router = useRouter();
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [view, setView] = useState<SheetView>("menu");

  const [linkUrl, setLinkUrl] = useState("");
  const [voteOptions, setVoteOptions] = useState(["", ""]);
  const [voteDeadline, setVoteDeadline] = useState("");
  const [askText, setAskText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function closeSheet() {
    setSheetOpen(false);
    setView("menu");
    setError(null);
  }

  function openSheet() {
    setAskText(draft);
    setSheetOpen(true);
    setView("menu");
  }

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

  async function submitLink() {
    if (!linkUrl.trim()) return;
    setSubmitting(true);
    setError(null);
    const res = await fetch(`/api/trips/${tripId}/ideas`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: linkUrl.trim() }),
    });
    setSubmitting(false);
    if (!res.ok) {
      setError("Couldn't file that link — check it's a valid URL.");
      return;
    }
    setLinkUrl("");
    closeSheet();
    router.refresh();
  }

  async function submitVote() {
    const options = voteOptions.map((o) => o.trim()).filter(Boolean);
    if (options.length < 2) {
      setError("Give it at least two options.");
      return;
    }
    setSubmitting(true);
    setError(null);
    const res = await fetch(`/api/trips/${tripId}/decisions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "CUSTOM",
        options: options.map((label, i) => ({ id: `option-${i}`, label })),
        ...(voteDeadline ? { deadline: new Date(voteDeadline).toISOString() } : {}),
      }),
    });
    setSubmitting(false);
    if (!res.ok) {
      setError("Couldn't put that to a vote — try again.");
      return;
    }
    setVoteOptions(["", ""]);
    setVoteDeadline("");
    closeSheet();
    router.refresh();
  }

  async function submitAsk() {
    const question = askText.trim();
    if (!question) return;
    setSubmitting(true);
    setError(null);
    const res = await fetch(`/api/trips/${tripId}/thread`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: question, intent: "ask" }),
    });
    setSubmitting(false);
    if (!res.ok) {
      setError("Couldn't ask that — try again.");
      return;
    }
    setDraft("");
    closeSheet();
    router.push(`/trip/${tripId}/you`);
  }

  return (
    <>
      <div className="border-t border-line bg-card px-3.5 py-2.5 pb-5 flex gap-2.5 items-center">
        <button
          onClick={openSheet}
          aria-label="More"
          className="size-9 shrink-0 rounded-full border border-line text-ink-2 grid place-items-center transition-colors hover:bg-sunk"
        >
          <Plus className="size-4" />
        </button>
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
          className="size-9 shrink-0 rounded-full bg-plum text-white grid place-items-center transition-transform active:scale-90 disabled:opacity-40"
          aria-label="Send"
        >
          <SendHorizontal className="size-4" />
        </button>
      </div>

      <BottomSheet open={sheetOpen} onClose={closeSheet}>
        {view === "menu" && (
          <div className="flex flex-col">
            <div className="flex flex-col gap-0.5 pb-1">
              <ActionRow
                icon={<Link2 className="size-4" />}
                title="Drop a link"
                subtitle="Instagram, YouTube, a blog. I'll pull the place out of it."
                onClick={() => setView("link")}
              />
              {isAdmin && (
                <ActionRow
                  icon={<Vote className="size-4" />}
                  title="Put something to a vote"
                  subtitle="Options, a deadline, done."
                  onClick={() => setView("vote")}
                />
              )}
              <ActionRow
                icon={<Sparkles className="size-4" />}
                title="Ask the agent"
                subtitle="Costs, dates, who's said what."
                onClick={() => setView("ask")}
              />
            </div>
          </div>
        )}

        {view === "link" && (
          <div className="flex flex-col gap-3">
            <h2 className="font-display text-lg font-semibold">Drop a link</h2>
            <input
              autoFocus
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="https://instagram.com/…"
              className="rounded-md border border-line bg-paper p-3.5 text-sm"
            />
            {error && <p className="text-xs text-stop">{error}</p>}
            <button
              disabled={submitting || !linkUrl.trim()}
              onClick={submitLink}
              className="w-full rounded-xl bg-plum py-3.5 font-semibold text-white disabled:opacity-40"
            >
              {submitting ? "Filing…" : "Add to ideas"}
            </button>
          </div>
        )}

        {view === "vote" && (
          <div className="flex flex-col gap-3">
            <h2 className="font-display text-lg font-semibold">Put something to a vote</h2>
            <div className="flex flex-col gap-2">
              {voteOptions.map((opt, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    value={opt}
                    onChange={(e) => setVoteOptions((cur) => cur.map((o, idx) => (idx === i ? e.target.value : o)))}
                    placeholder={`Option ${i + 1}`}
                    className="flex-1 rounded-md border border-line bg-paper p-3 text-sm"
                  />
                  {voteOptions.length > 2 && (
                    <button
                      aria-label="Remove option"
                      onClick={() => setVoteOptions((cur) => cur.filter((_, idx) => idx !== i))}
                      className="text-ink-3 transition-colors hover:text-stop"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  )}
                </div>
              ))}
              {voteOptions.length < 6 && (
                <button
                  onClick={() => setVoteOptions((cur) => [...cur, ""])}
                  className="self-start text-xs font-semibold text-plum"
                >
                  + Add option
                </button>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-ink-2">Deadline (optional)</label>
              <input
                type="datetime-local"
                value={voteDeadline}
                onChange={(e) => setVoteDeadline(e.target.value)}
                className="rounded-md border border-line bg-paper p-3 text-sm"
              />
            </div>
            {error && <p className="text-xs text-stop">{error}</p>}
            <button
              disabled={submitting}
              onClick={submitVote}
              className="w-full rounded-xl bg-plum py-3.5 font-semibold text-white disabled:opacity-40"
            >
              {submitting ? "Opening…" : "Put it to a vote"}
            </button>
          </div>
        )}

        {view === "ask" && (
          <div className="flex flex-col gap-3">
            <h2 className="font-display text-lg font-semibold">Ask the agent</h2>
            <p className="text-xs text-ink-3">Answers in your own thread, from what&rsquo;s already on Plan.</p>
            <textarea
              autoFocus
              value={askText}
              onChange={(e) => setAskText(e.target.value)}
              placeholder="What's the cost estimate looking like?"
              rows={3}
              className="rounded-md border border-line bg-paper p-3.5 text-sm"
            />
            {error && <p className="text-xs text-stop">{error}</p>}
            <button
              disabled={submitting || !askText.trim()}
              onClick={submitAsk}
              className="w-full rounded-xl bg-plum py-3.5 font-semibold text-white disabled:opacity-40"
            >
              {submitting ? "Asking…" : "Ask"}
            </button>
          </div>
        )}
      </BottomSheet>
    </>
  );
}

function ActionRow({
  icon,
  title,
  subtitle,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <button onClick={onClick} className="flex items-center gap-3 py-2.5 text-left transition-colors hover:bg-sunk rounded-lg px-1">
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-sunk text-ink-2">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{title}</span>
        <span className="block text-xs text-ink-3">{subtitle}</span>
      </span>
      <span className="text-ink-3">&rsaquo;</span>
    </button>
  );
}
