"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function ToggleJoiningButton({ tripId, joiningOpen }: { tripId: string; joiningOpen: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function toggle() {
    setPending(true);
    await fetch(`/api/trips/${tripId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "toggle_joining" }),
    });
    setPending(false);
    router.refresh();
  }

  return (
    <button
      disabled={pending}
      onClick={toggle}
      className="shrink-0 text-sm font-semibold text-plum transition-opacity disabled:opacity-40"
    >
      {joiningOpen ? "Shut it" : "Reopen it"}
    </button>
  );
}
