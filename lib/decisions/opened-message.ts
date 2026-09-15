import { DECISION_TYPE_TITLE } from "@/lib/decision-titles";
import type { DecisionOption, DecisionType } from "@/lib/database.types";

// F2 (docs/design/screens.html): a decision opening is worth a line in the
// group feed, not just a card that only ever shows up if you happen to open
// Plan. Scout/Chaser already announce the decisions they create themselves;
// this covers the admin-created path (POST /decisions), the one place that
// wasn't announcing anything.
export function buildDecisionOpenedMessage(decision: {
  type: DecisionType;
  options: DecisionOption[];
  deadline: string | null;
}): string {
  const title = DECISION_TYPE_TITLE[decision.type] ?? "Decision";
  const optionCount = decision.options.length;
  const optionWord = optionCount === 1 ? "option" : "options";
  const deadlineText = decision.deadline
    ? `, closes ${new Date(decision.deadline).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`
    : "";
  return `New vote: ${title} — ${optionCount} ${optionWord}${deadlineText}. Vote on Plan.`;
}
