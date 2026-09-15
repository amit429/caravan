"use client";
import { useEffect, useState } from "react";

export function InviteLinkCard({ inviteCode }: { inviteCode: string }) {
  const [copied, setCopied] = useState<"link" | "code" | null>(null);
  // window.location.origin is unavailable during SSR — resolved after mount,
  // same pattern as ShareSnapshot (the app has more than one valid production
  // domain, so the link can't be hardcoded).
  const [origin, setOrigin] = useState("");
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- window.location is unavailable during SSR; one-time post-mount read
    setOrigin(window.location.origin);
  }, []);

  const link = `${origin}/join/${inviteCode}`;

  async function copy(what: "link" | "code") {
    await navigator.clipboard.writeText(what === "link" ? link : inviteCode);
    setCopied(what);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <div className="flex flex-col gap-2.5 px-3.5 py-3">
      <div className="flex items-center gap-2">
        <input
          readOnly
          value={link || `/join/${inviteCode}`}
          onFocus={(e) => e.currentTarget.select()}
          className="min-w-0 flex-1 truncate rounded-lg border border-line bg-sunk px-3 py-2 text-xs text-ink-2"
        />
        <button
          onClick={() => copy("link")}
          disabled={!origin}
          className="shrink-0 rounded-lg bg-plum px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"
        >
          {copied === "link" ? "Copied!" : "Copy link"}
        </button>
      </div>
      <div className="flex items-center gap-2 text-xs text-ink-3">
        <span>
          Or share the code: <span className="font-mono font-semibold text-ink">{inviteCode}</span>
        </span>
        <button onClick={() => copy("code")} className="font-semibold text-plum">
          {copied === "code" ? "Copied!" : "Copy code"}
        </button>
      </div>
    </div>
  );
}
