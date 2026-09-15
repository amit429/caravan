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

// member_id -> day (iso) -> status submitted for that day. A member's
// intake calendar submission wipes and replaces their prior rows wholesale
// (see intake route), but a later chat correction ("actually I can't make
// the 5th" — or the reverse, "turns out I can now") is scribed as a new,
// separate row alongside the calendar data. Whichever statement is newer
// wins, in either direction; only when two rows were filed at the exact
// same instant do we fall back to the more restrictive one as a tie-break.
function buildStatusMap(availability: AvailabilityRow[]): Map<string, Map<string, { strength: Status; createdAt: string }>> {
  const map = new Map<string, Map<string, { strength: Status; createdAt: string }>>();
  for (const row of availability) {
    let perDay = map.get(row.member_id);
    if (!perDay) {
      perDay = new Map();
      map.set(row.member_id, perDay);
    }
    for (const day of enumerateDays(row.start_date, row.end_date)) {
      const existing = perDay.get(day);
      const isNewer = !existing || row.created_at > existing.createdAt;
      const isTiedButWorse =
        existing && row.created_at === existing.createdAt && STATUS_RANK[row.strength] > STATUS_RANK[existing.strength];
      if (isNewer || isTiedButWorse) {
        perDay.set(day, { strength: row.strength, createdAt: row.created_at });
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
        const status = perDay?.get(day)?.strength;
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

  // Sliding a fixed-length window one day at a time across a long, evenly-free
  // stretch produces dozens of candidates with identical attendance — e.g. a
  // group that's wide open for two weeks straight yields the same "everyone's
  // in" outcome at every offset. Surfacing each as its own vote option isn't 3
  // real choices, it's the same good news chopped into arbitrary consecutive
  // slices (the literal bug report this fixes: 27 Feb–2 Mar / 3–6 / 7–10 out
  // of one continuous free run). Collapse consecutive candidates with the same
  // score and the same attendance into a single run, so an option only shows
  // up again when something about it is actually different.
  // Candidates are already date-adjacent by construction (the offset loop
  // above advances one day at a time), so it's enough to compare each one
  // to the immediately preceding candidate — not to the frozen start of
  // whatever run is currently open — to tell whether it's still the same
  // stretch or a genuinely new one.
  const runs: DateWindow[] = [];
  let previousCandidate: DateWindow | null = null;
  for (const candidate of candidates) {
    const continuesRun = previousCandidate && previousCandidate.score === candidate.score && sameMembers(previousCandidate, candidate);
    if (!continuesRun) runs.push(candidate); // first offset of a new run represents the whole stretch
    previousCandidate = candidate;
  }

  runs.sort((a, b) => b.score - a.score || (a.startDate < b.startDate ? -1 : 1));

  const results: DateWindow[] = [];
  for (const run of runs) {
    const overlapsExisting = results.some((r) => !(run.endDate < r.startDate || run.startDate > r.endDate));
    if (!overlapsExisting) results.push(run);
    if (results.length === 3) break;
  }

  return results;
}

function sameMembers(a: DateWindow, b: DateWindow): boolean {
  const key = (w: DateWindow) => [...w.membersIn].sort().join(",") + "|" + [...w.membersPartial].sort().join(",");
  return key(a) === key(b);
}
