import type { FactCategory } from "@/lib/database.types";

export const FACT_CATEGORY_LABEL: Record<FactCategory, string> = {
  budget: "Budget",
  departure_city: "Departure city",
  vibe: "Vibe",
  hard_no: "Hard no",
};

// Facts filed from the intake form and facts Scribe extracts from free text
// don't share one value shape per category ({items:[]} from intake's combined
// hard-no row vs {text} from a single Scribe extraction, for example) — this
// reads whichever recognizable key is present instead of assuming one shape.
export function formatFactValue(value: unknown): string {
  if (value && typeof value === "object") {
    const v = value as Record<string, unknown>;
    if (Array.isArray(v.items)) return v.items.join(", ");
    if (Array.isArray(v.tags)) return v.tags.join(", ");
    if (typeof v.text === "string") return v.text;
    if (typeof v.city === "string") return v.city;
    if (typeof v.band === "string") return v.band;
  }
  if (typeof value === "string") return value;
  return "—";
}
