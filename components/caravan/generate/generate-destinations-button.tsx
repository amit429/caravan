"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function GenerateDestinationsButton({ tripId }: { tripId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setPending(true);
    setError(null);
    const res = await fetch(`/api/trips/${tripId}/scout`, { method: "POST" });
    setPending(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Something went wrong.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-1.5">
      <button
        disabled={pending}
        onClick={generate}
        className="text-sm font-semibold text-plum disabled:opacity-40"
      >
        {pending ? "Thinking…" : "Generate destination options"}
      </button>
      {error && <p className="text-xs text-stop">{error}</p>}
    </div>
  );
}
