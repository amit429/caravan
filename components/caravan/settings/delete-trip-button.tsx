"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useConfirm } from "@/components/caravan/shared/use-confirm";

export function DeleteTripButton({ tripId, tripName }: { tripId: string; tripName: string }) {
  const router = useRouter();
  const { confirm, dialog } = useConfirm();
  const [pending, setPending] = useState(false);

  async function remove() {
    if (
      !(await confirm(
        `Delete "${tripName}"?`,
        "This erases the trip for everyone — messages, decisions, bookings, all of it. There's no undo.",
        { destructive: true }
      ))
    )
      return;
    setPending(true);
    const res = await fetch(`/api/trips/${tripId}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/trips");
      return;
    }
    setPending(false);
  }

  return (
    <>
      {dialog}
      <button
        disabled={pending}
        onClick={remove}
        className="w-full rounded-xl border border-stop py-3.5 text-center font-semibold text-stop transition-opacity disabled:opacity-40"
      >
        {pending ? "Deleting…" : "Delete this trip"}
      </button>
    </>
  );
}
