"use client";
import { useEffect, useState } from "react";
import { buildTripSummary } from "@/lib/whatsapp-summary";

export function ShareSnapshot({
  tripName,
  destinationLabel,
  datesLabel,
  groupCeiling,
  checklist,
  inviteCode,
}: {
  tripName: string;
  destinationLabel: string | null;
  datesLabel: string | null;
  groupCeiling: number | null;
  checklist: { done: number; total: number } | null;
  inviteCode: string;
}) {
  const [copied, setCopied] = useState(false);
  // window.location.origin is unavailable during SSR — resolved after mount,
  // same pattern as the invite-link page (spec: don't hardcode a site URL,
  // the app has more than one valid production domain).
  const [origin, setOrigin] = useState("");
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- window.location is unavailable during SSR; this is the one-time post-mount read, not a derived-state anti-pattern
    setOrigin(window.location.origin);
  }, []);

  const summary = buildTripSummary({
    tripName,
    destinationLabel,
    datesLabel,
    groupCeiling,
    checklist,
    inviteUrl: `${origin}/join/${inviteCode}`,
  });
  const waLink = `https://wa.me/?text=${encodeURIComponent(summary)}`;

  async function copy() {
    await navigator.clipboard.writeText(summary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-line bg-card p-3">
      <pre className="whitespace-pre-wrap font-sans text-sm">{summary}</pre>
      <div className="flex gap-3 pt-1">
        <button onClick={copy} className="text-xs font-semibold text-plum">
          {copied ? "Copied!" : "Copy"}
        </button>
        <a href={waLink} target="_blank" rel="noreferrer" className="text-xs font-semibold text-signal-d">
          Share to WhatsApp
        </a>
      </div>
    </div>
  );
}
