"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useConfirm } from "@/components/caravan/shared/use-confirm";

export function RemoveMemberButton({
  tripId,
  memberId,
  memberName,
}: {
  tripId: string;
  memberId: string;
  memberName: string;
}) {
  const router = useRouter();
  const { confirm, dialog } = useConfirm();
  const [pending, setPending] = useState(false);

  async function remove() {
    if (
      !(await confirm(
        `Remove ${memberName}?`,
        "Their budget, vibe, and other answers are erased, and anything not locked in yet gets regenerated for whoever's left.",
        { destructive: true }
      ))
    )
      return;
    setPending(true);
    await fetch(`/api/trips/${tripId}/members/${memberId}/remove`, { method: "POST" });
    setPending(false);
    router.refresh();
  }

  return (
    <>
      {dialog}
      <button
        disabled={pending}
        onClick={remove}
        aria-label={`Remove ${memberName}`}
        className="shrink-0 text-xs font-semibold text-stop transition-opacity disabled:opacity-40"
      >
        {pending ? "Removing…" : "Remove"}
      </button>
    </>
  );
}
