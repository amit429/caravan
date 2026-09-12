"use client";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { AppBar } from "@/components/caravan/app-bar";

export default function JoinFormPage() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    setSubmitting(true);
    setError(null);
    const res = await fetch(`/api/join/${code}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName, email }),
    });
    setSubmitting(false);
    if (!res.ok) {
      setError("Couldn't join right now — check your details and try again.");
      return;
    }
    const { member } = await res.json();
    router.push(`/trip/${member.trip_id}/member-lobby`);
  }

  return (
    <main className="min-h-screen flex flex-col max-w-md mx-auto">
      <AppBar title="Join" />
      <div className="flex-1 flex flex-col gap-4 px-5">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-ink-2">Your name</label>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Ishaan"
            className="bg-card border border-line rounded-md p-3.5"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-ink-2">Email</label>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="ishaan@..."
            type="email"
            className="bg-card border border-line rounded-md p-3.5"
          />
        </div>
        <p className="text-xs text-ink-3">
          Email is only for nudges and for getting back in from another phone. There is no
          password to forget.
        </p>
        {error && <p className="text-xs text-stop">{error}</p>}
      </div>
      <div className="px-5 pb-10 pt-4">
        <button
          disabled={!displayName.trim() || !email.trim() || submitting}
          onClick={submit}
          className="w-full py-4 rounded-xl bg-plum text-white font-semibold disabled:opacity-40"
        >
          Join
        </button>
      </div>
    </main>
  );
}
