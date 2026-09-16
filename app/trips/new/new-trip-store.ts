"use client";

export type NewTripDraft = {
  name: string;
  roughIntent: string;
  vibe: string[];
  budgetHint: string;
  agentTone: "efficient" | "warm" | "dry";
  preferredTripDays: number;
};

const KEY = "caravan_new_trip_draft";
const DEFAULT_DRAFT: NewTripDraft = {
  name: "",
  roughIntent: "",
  vibe: [],
  budgetHint: "",
  agentTone: "efficient",
  preferredTripDays: 7,
};

export function readDraft(): NewTripDraft {
  if (typeof window === "undefined") {
    return DEFAULT_DRAFT;
  }
  const raw = sessionStorage.getItem(KEY);
  return raw ? { ...DEFAULT_DRAFT, ...JSON.parse(raw) } : DEFAULT_DRAFT;
}

export function writeDraft(patch: Partial<NewTripDraft>) {
  const next = { ...readDraft(), ...patch };
  sessionStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

export function clearDraft() {
  sessionStorage.removeItem(KEY);
}
