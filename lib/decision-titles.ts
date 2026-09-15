import type { DecisionType } from "@/lib/database.types";

export const DECISION_TYPE_TITLE: Record<DecisionType, string> = {
  DATES: "When are we going?",
  DESTINATION: "Where are we going?",
  BUDGET: "What's the budget?",
  STAY: "Where are we staying?",
  ACTIVITY: "What are we doing?",
  CUSTOM: "Decision",
};
