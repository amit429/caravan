"use client";
import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Strength } from "@/lib/dates/availability-calendar";

const CYCLE: (Strength | null)[] = [null, "free", "partial", "blocked"];
const DOW = ["M", "T", "W", "T", "F", "S", "S"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function toIso(year: number, month: number, day: number) {
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}

const STRENGTH_CLASS: Record<Strength, string> = {
  free: "bg-signal text-[#2F3708] font-semibold",
  partial: "bg-warn-t text-warn font-medium",
  blocked: "bg-stop-t text-stop line-through",
};

type DragState = {
  active: boolean;
  moved: boolean;
  startDate: string | null;
  touched: Set<string>;
};

export function AvailabilityCalendar({
  marks,
  onChange,
}: {
  marks: Record<string, Strength>;
  onChange: (marks: Record<string, Strength>) => void;
}) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const dragRef = useRef<DragState>({ active: false, moved: false, startDate: null, touched: new Set() });

  function goToPreviousMonth() {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  }

  function goToNextMonth() {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  }

  const firstWeekday = (new Date(viewYear, viewMonth, 1).getDay() + 6) % 7; // Monday = 0
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  function setDay(date: string, strength: Strength) {
    if (marks[date] === strength) return;
    onChange({ ...marks, [date]: strength });
  }

  function cycleDay(date: string) {
    const idx = CYCLE.indexOf(marks[date] ?? null);
    const next = CYCLE[(idx + 1) % CYCLE.length];
    const updated = { ...marks };
    if (next === null) delete updated[date];
    else updated[date] = next;
    onChange(updated);
  }

  function dateFromPoint(x: number, y: number): string | null {
    const el = document.elementFromPoint(x, y) as HTMLElement | null;
    return el?.closest<HTMLElement>("[data-date]")?.dataset.date ?? null;
  }

  function onPointerDown(e: React.PointerEvent) {
    const date = dateFromPoint(e.clientX, e.clientY);
    if (!date) return;
    dragRef.current = { active: true, moved: false, startDate: date, touched: new Set([date]) };
  }

  function onPointerMove(e: React.PointerEvent) {
    const drag = dragRef.current;
    if (!drag.active || !drag.startDate) return;
    const date = dateFromPoint(e.clientX, e.clientY);
    if (!date) return;
    if (date !== drag.startDate && !drag.moved) {
      drag.moved = true;
      setDay(drag.startDate, "free");
    }
    if (drag.moved && !drag.touched.has(date)) {
      drag.touched.add(date);
      setDay(date, "free");
    }
  }

  function endDrag() {
    const drag = dragRef.current;
    if (drag.active && !drag.moved && drag.startDate) {
      cycleDay(drag.startDate);
    }
    dragRef.current = { active: false, moved: false, startDate: null, touched: new Set() };
  }

  return (
    <div className="flex flex-col gap-2.5">
      <div className="rounded-lg bg-card p-3.5">
        <div className="mb-2.5 flex items-center text-sm font-semibold">
          {MONTH_NAMES[viewMonth]} {viewYear}
          <span className="ml-auto flex gap-3.5 text-ink-3">
            <button type="button" aria-label="Previous month" onClick={goToPreviousMonth}>
              <ChevronLeft className="size-4" />
            </button>
            <button type="button" aria-label="Next month" onClick={goToNextMonth}>
              <ChevronRight className="size-4" />
            </button>
          </span>
        </div>
        <div className="grid grid-cols-7 gap-[3px]">
          {DOW.map((d, i) => (
            <span key={i} className="pb-1 text-center font-mono text-[10px] text-ink-3">
              {d}
            </span>
          ))}
        </div>
        <div
          className="grid grid-cols-7 gap-[3px] select-none"
          style={{ touchAction: "none" }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onPointerLeave={(e) => e.buttons === 0 && endDrag()}
        >
          {cells.map((day, i) => {
            if (day === null) return <b key={i} className="aspect-square" />;
            const date = toIso(viewYear, viewMonth, day);
            const strength = marks[date];
            return (
              <b
                key={i}
                data-date={date}
                className={`flex aspect-square items-center justify-center rounded-lg text-[12.5px] text-ink-2 ${
                  strength ? STRENGTH_CLASS[strength] : ""
                }`}
              >
                {day}
              </b>
            );
          })}
        </div>
      </div>
      <div className="flex gap-3.5 text-xs">
        <span className="flex items-center gap-1.5 text-ink-2">
          <span className="size-2.5 rounded-sm bg-signal" /> free
        </span>
        <span className="flex items-center gap-1.5 text-ink-2">
          <span className="size-2.5 rounded-sm bg-warn-t" /> tight
        </span>
        <span className="flex items-center gap-1.5 text-ink-2">
          <span className="size-2.5 rounded-sm bg-stop-t" /> can&rsquo;t
        </span>
      </div>
    </div>
  );
}
