import type { AvailabilityRow } from "../database.types";

export type DateWindow = {
  startDate: string;
  endDate: string;
  membersIn: string[];
  membersPartial: string[];
  membersOut: string[];
  score: number;
};

// Shared between the manual "Put these to a vote" button
// (components/caravan/decisions/create-dates-decision-button.tsx) and
// Chaser's autonomous DATES-decision creation — both need to turn a window
// into the same short label a decision's option ends up showing.
export function formatWindowLabel(window: Pick<DateWindow, "startDate" | "endDate">): string {
  const format = (iso: string) =>
    new Date(`${iso}T00:00:00Z`).toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" });
  return `${format(window.startDate)} – ${format(window.endDate)}`;
}

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

// Slides one fixed-length window across the span, scoring each offset by
// attendance (partial counts half). Sliding one day at a time across a long,
// evenly-free stretch produces dozens of candidates with identical
// attendance — e.g. a group that's wide open for two weeks straight yields
// the same "everyone's in" outcome at every offset. Surfacing each as its
// own vote option isn't 3 real choices, it's the same good news chopped into
// arbitrary consecutive slices (the literal bug report this fixes: 27 Feb–2
// Mar / 3–6 / 7–10 out of one continuous free run). Collapse consecutive
// candidates with the same score and the same attendance into a single run
// — candidates are already date-adjacent by construction (the offset loop
// advances one day at a time), so it's enough to compare each one to the
// immediately preceding candidate, not to the frozen start of whatever run
// is currently open, to tell whether it's still the same stretch or new.
function computeRunsForLength(
  statusMap: Map<string, Map<string, { strength: Status; createdAt: string }>>,
  spanStart: string,
  spanEnd: string,
  activeMemberIds: string[],
  length: number
): DateWindow[] {
  const lastPossibleOffset = daysBetween(spanStart, spanEnd) - length + 1;
  if (lastPossibleOffset < 0) return [];

  const candidates: DateWindow[] = [];

  for (let offset = 0; offset <= lastPossibleOffset; offset++) {
    const windowStart = addDays(spanStart, offset);
    const windowEnd = addDays(windowStart, length - 1);
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

  const runs: DateWindow[] = [];
  let previousCandidate: DateWindow | null = null;
  for (const candidate of candidates) {
    const continuesRun = previousCandidate && previousCandidate.score === candidate.score && sameMembers(previousCandidate, candidate);
    if (!continuesRun) runs.push(candidate); // first offset of a new run represents the whole stretch
    previousCandidate = candidate;
  }
  return runs;
}

function sameMembers(a: DateWindow, b: DateWindow): boolean {
  return membershipKey(a) === membershipKey(b);
}

function membershipKey(w: DateWindow): string {
  return [...w.membersIn].sort().join(",") + "|" + [...w.membersPartial].sort().join(",");
}

/**
 * Deterministic date solver (F6). No LLM involved: plain interval math over
 * submitted availability, prioritized by the group's preferred trip length
 * (n days = n-1 nights, same convention throughout the app).
 *
 * Option 1 is always the best window at the *full* preferred length,
 * regardless of whether a shorter window elsewhere scores higher — the
 * group asked for an n-day trip, so that's the first thing on the table,
 * not just whatever slice happens to fit the most people.
 *
 * Options 2 and 3 trade duration for attendance: every window at every
 * length from the preferred length down to a single day is a candidate,
 * ranked by attendance first (more people fitting beats a longer trip),
 * then by longer duration as a tiebreak among equally-attended options,
 * then by earliest start. These are deliberately allowed to overlap option
 * 1 in date range — a shorter, more-inclusive window is a genuinely
 * different proposal from the full-length one, not a competing slice of the
 * same calendar slot (the group votes for exactly one of the three; they're
 * alternatives, not a non-overlapping schedule). What IS excluded is an
 * option with a membership signature already claimed by an earlier
 * (always-longer, since lengths are processed longest-first) option, so a
 * 1-day slice of the exact same "everyone's still free" stretch option 1
 * already represents never gets surfaced as if it were new information.
 */
export function computeTopDateWindows(
  availability: AvailabilityRow[],
  activeMemberIds: string[],
  preferredDays = 7
): DateWindow[] {
  if (availability.length === 0 || activeMemberIds.length === 0) return [];

  const statusMap = buildStatusMap(availability);
  const allDates = availability.flatMap((row) => [row.start_date, row.end_date]);
  const spanStart = allDates.reduce((a, b) => (a < b ? a : b));
  const spanEnd = allDates.reduce((a, b) => (a > b ? a : b));
  const spanLengthDays = daysBetween(spanStart, spanEnd) + 1;
  const topLength = Math.min(preferredDays, spanLengthDays);

  const runsByLength: DateWindow[] = [];
  for (let length = topLength; length >= 1; length--) {
    runsByLength.push(...computeRunsForLength(statusMap, spanStart, spanEnd, activeMemberIds, length));
  }

  const fullLengthRuns = runsByLength
    .filter((r) => daysBetween(r.startDate, r.endDate) + 1 === topLength)
    .sort((a, b) => b.score - a.score || (a.startDate < b.startDate ? -1 : 1));

  const results: DateWindow[] = [];
  if (fullLengthRuns.length > 0) results.push(fullLengthRuns[0]);

  const seenSignatures = new Set(results.map(membershipKey));
  const remaining = runsByLength
    .filter((r) => !seenSignatures.has(membershipKey(r)))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const lengthA = daysBetween(a.startDate, a.endDate);
      const lengthB = daysBetween(b.startDate, b.endDate);
      if (lengthB !== lengthA) return lengthB - lengthA; // longer trip wins when attendance ties
      return a.startDate < b.startDate ? -1 : 1;
    });

  for (const run of remaining) {
    if (results.length === 3) break;
    if (seenSignatures.has(membershipKey(run))) continue; // an earlier, longer run with the same signature already claimed this slot
    results.push(run);
    seenSignatures.add(membershipKey(run));
  }

  return results;
}
