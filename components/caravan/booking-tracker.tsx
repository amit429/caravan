"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { BookingRow, BookingStatusRow, MemberRow } from "@/lib/database.types";

function BookingItem({
  tripId,
  booking,
  members,
  statusByMember,
  myMemberId,
  isAdmin,
}: {
  tripId: string;
  booking: BookingRow;
  members: MemberRow[];
  statusByMember: Map<string, boolean>;
  myMemberId: string;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const bookedCount = members.filter((m) => statusByMember.get(m.id)).length;
  const myBooked = statusByMember.get(myMemberId) ?? false;

  async function setStatus(booked: boolean) {
    setPending(true);
    await fetch(`/api/trips/${tripId}/bookings/${booking.id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ booked }),
    });
    setPending(false);
    router.refresh();
  }

  async function nudge() {
    setPending(true);
    await fetch(`/api/trips/${tripId}/bookings/${booking.id}/nudge`, { method: "POST" });
    setPending(false);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-line bg-card p-3">
      <div className="flex items-center gap-2">
        <span className="flex-1 text-sm font-semibold">{booking.item}</span>
        {booking.deadline && (
          <span className="text-[10px] font-mono text-ink-3">
            by {new Date(`${booking.deadline}T00:00:00Z`).toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" })}
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {members.map((m) => {
          const booked = statusByMember.get(m.id) ?? false;
          return (
            <span
              key={m.id}
              className={`rounded-full px-2 py-1 text-[10px] font-semibold ${
                booked ? "bg-agent-t text-agent" : "bg-sunk text-ink-3"
              }`}
            >
              {m.display_name}
            </span>
          );
        })}
      </div>
      <div className="flex items-center gap-3">
        <button
          disabled={pending}
          onClick={() => setStatus(!myBooked)}
          className="text-xs font-semibold text-plum disabled:opacity-40"
        >
          {myBooked ? "Mark not booked" : "Mark booked"}
        </button>
        {isAdmin && bookedCount < members.length && (
          <button disabled={pending} onClick={nudge} className="text-xs text-ink-3 underline">
            Nudge unbooked
          </button>
        )}
      </div>
    </div>
  );
}

export function BookingTracker({
  tripId,
  bookings,
  statuses,
  members,
  myMemberId,
  isAdmin,
}: {
  tripId: string;
  bookings: BookingRow[];
  statuses: BookingStatusRow[];
  members: MemberRow[];
  myMemberId: string;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [item, setItem] = useState("");
  const [pending, setPending] = useState(false);

  async function addBooking() {
    if (!item.trim()) return;
    setPending(true);
    await fetch(`/api/trips/${tripId}/bookings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ item: item.trim() }),
    });
    setPending(false);
    setItem("");
    router.refresh();
  }

  const statusByBooking = new Map<string, Map<string, boolean>>();
  for (const s of statuses) {
    const m = statusByBooking.get(s.booking_id) ?? new Map<string, boolean>();
    m.set(s.member_id, s.booked);
    statusByBooking.set(s.booking_id, m);
  }

  return (
    <div className="flex flex-col gap-3">
      {isAdmin && (
        <div className="flex gap-2">
          <input
            value={item}
            onChange={(e) => setItem(e.target.value)}
            placeholder="e.g. Flight, Hotel…"
            className="flex-1 rounded-lg border border-line bg-card px-3 py-2 text-sm outline-none focus:border-plum"
          />
          <button
            disabled={pending}
            onClick={addBooking}
            className="shrink-0 rounded-lg bg-plum px-3.5 py-2 text-sm font-semibold text-white disabled:opacity-40"
          >
            Add
          </button>
        </div>
      )}
      {bookings.length === 0 ? (
        <p className="text-sm text-ink-2">Nothing being tracked yet.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {bookings.map((b) => (
            <BookingItem
              key={b.id}
              tripId={tripId}
              booking={b}
              members={members}
              statusByMember={statusByBooking.get(b.id) ?? new Map()}
              myMemberId={myMemberId}
              isAdmin={isAdmin}
            />
          ))}
        </div>
      )}
    </div>
  );
}
