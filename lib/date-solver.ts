import type { AvailabilityRow } from "./database.types";

export type DateWindow = {
  startDate: string;
  endDate: string;
  membersIn: string[];
  membersPartial: string[];
  membersOut: string[];
  score: number;
};

type Status = "free" | "partial" | "blocked";

const DAY_MS = 24 * 60 * 60 * 1000;
const STATUS_RANK: Record<Status, number> = { free: 0, partial: 1, blocked: 2 };

function toDate(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

function toIso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(iso: string, days: number): string {
  const d = toDate(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return toIso(d);
}

function daysBetween(a: string, b: string): number {
  return Math.round((toDate(b).getTime() - toDate(a).getTime()) / DAY_MS);
}

function enumerateDays(start: string, end: string): string[] {
  const days: string[] = [];
  let cur = start;
  while (cur <= end) {
    days.push(cur);
    cur = addDays(cur, 1);
  }
  return days;
}

// member_id -> day (iso) -> worst-case status submitted for that day.
function buildStatusMap(availability: AvailabilityRow[]): Map<string, Map<string, Status>> {
  const map = new Map<string, Map<string, Status>>();
  for (const row of availability) {
    let perDay = map.get(row.member_id);
    if (!perDay) {
      perDay = new Map();
      map.set(row.member_id, perDay);
    }
    for (const day of enumerateDays(row.start_date, row.end_date)) {
      const existing = perDay.get(day);
      if (!existing || STATUS_RANK[row.strength] > STATUS_RANK[existing]) {
        perDay.set(day, row.strength);
      }
    }
  }
  return map;
}

/**
 * Deterministic date solver (F6). No LLM involved: plain interval math over
 * submitted availability. Slides a fixed-length window across the submitted
 * date span, scores each by attendance (partial counts half), and returns
 * up to the top 3 non-overlapping windows.
 */
export function computeTopDateWindows(
  availability: AvailabilityRow[],
  activeMemberIds: string[],
  windowLengthDays = 4
): DateWindow[] {
  if (availability.length === 0 || activeMemberIds.length === 0) return [];

  const statusMap = buildStatusMap(availability);
  const allDates = availability.flatMap((row) => [row.start_date, row.end_date]);
  const spanStart = allDates.reduce((a, b) => (a < b ? a : b));
  const spanEnd = allDates.reduce((a, b) => (a > b ? a : b));
  const spanLengthDays = daysBetween(spanStart, spanEnd) + 1;
  const effectiveWindowLength = Math.min(windowLengthDays, spanLengthDays);
  const lastPossibleOffset = daysBetween(spanStart, spanEnd) - effectiveWindowLength + 1;

  const candidates: DateWindow[] = [];

  for (let offset = 0; offset <= lastPossibleOffset; offset++) {
    const windowStart = addDays(spanStart, offset);
    const windowEnd = addDays(windowStart, effectiveWindowLength - 1);
    const windowDays = enumerateDays(windowStart, windowEnd);

    const membersIn: string[] = [];
    const membersPartial: string[] = [];
    const membersOut: string[] = [];

    for (const memberId of activeMemberIds) {
      const perDay = statusMap.get(memberId);
      let hasBlocked = false;
      let hasPartial = false;
      let hasMissing = false;

      for (const day of windowDays) {
        const status = perDay?.get(day);
        if (!status) hasMissing = true;
        else if (status === "blocked") hasBlocked = true;
        else if (status === "partial") hasPartial = true;
      }

      if (hasBlocked || hasMissing) {
        membersOut.push(memberId);
      } else if (hasPartial) {
        membersPartial.push(memberId);
      } else {
        membersIn.push(memberId);
      }
    }

    const score = membersIn.length + membersPartial.length * 0.5;
    candidates.push({ startDate: windowStart, endDate: windowEnd, membersIn, membersPartial, membersOut, score });
  }

  candidates.sort((a, b) => b.score - a.score || (a.startDate < b.startDate ? -1 : 1));

  const results: DateWindow[] = [];
  for (const candidate of candidates) {
    const overlapsExisting = results.some(
      (r) => !(candidate.endDate < r.startDate || candidate.startDate > r.endDate)
    );
    if (!overlapsExisting) results.push(candidate);
    if (results.length === 3) break;
  }

  return results;
}
