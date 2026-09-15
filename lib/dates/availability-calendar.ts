export type Strength = "free" | "partial" | "blocked";

function isNextDay(a: string, b: string): boolean {
  const d = new Date(`${a}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10) === b;
}

// Calendar UI works day-by-day (spec C2: tap or drag individual days); the
// intake API takes ranges. Merging consecutive same-strength days back into
// ranges keeps the payload small (intakeSchema caps at 20 rows) instead of
// sending up to a month of one-day entries.
export function coalesceAvailability(
  marks: Record<string, Strength>
): { startDate: string; endDate: string; strength: Strength }[] {
  const dates = Object.keys(marks).sort();
  const ranges: { startDate: string; endDate: string; strength: Strength }[] = [];

  for (const date of dates) {
    const strength = marks[date];
    const last = ranges[ranges.length - 1];
    if (last && last.strength === strength && isNextDay(last.endDate, date)) {
      last.endDate = date;
    } else {
      ranges.push({ startDate: date, endDate: date, strength });
    }
  }

  return ranges;
}
