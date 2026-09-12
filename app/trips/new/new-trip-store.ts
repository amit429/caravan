"use client";

export type NewTripDraft = {
  name: string;
  roughIntent: string;
  vibe: string[];
  budgetHint: string;
  agentTone: "efficient" | "warm" | "dry";
};

const KEY = "caravan_new_trip_draft";

export function readDraft(): NewTripDraft {
  if (typeof window === "undefined") {
    return { name: "", roughIntent: "", vibe: [], budgetHint: "", agentTone: "efficient" };
  }
  const raw = sessionStorage.getItem(KEY);
  return raw
    ? JSON.parse(raw)
    : { name: "", roughIntent: "", vibe: [], budgetHint: "", agentTone: "efficient" };
}

export function writeDraft(patch: Partial<NewTripDraft>) {
  const next = { ...readDraft(), ...patch };
  sessionStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

export function clearDraft() {
  sessionStorage.removeItem(KEY);
}
