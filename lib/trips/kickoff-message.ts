// PRD D5 / docs/design/screens.html D1: "agent posts the kickoff message" the
// moment the admin opens the room — the trip goes from silent to live in one
// beat, not a slow trickle of "hi everyone" messages.
export function buildKickoffMessage(trip: { rough_intent: string | null; vibe: string[]; budget_hint: string | null }): string {
  const intent = trip.rough_intent?.trim();
  const budgetText = trip.budget_hint ? `, ${trip.budget_hint} a head` : "";

  let summary: string;
  if (intent) {
    summary = `${intent}${budgetText}`;
  } else if (trip.vibe.length > 0) {
    summary = `something ${trip.vibe.join(", ").toLowerCase()}${budgetText}`;
  } else {
    summary = "a trip";
  }

  return `Right — ${summary}. I've sent each of you five questions in your own thread. Fill those in and I'll work out which dates actually work for everyone. Meanwhile — argue about where. That's what this room is for.`;
}
