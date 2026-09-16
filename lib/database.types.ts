export type TripRow = {
  id: string;
  name: string;
  rough_intent: string | null;
  admin_user_id: string;
  invite_code: string;
  status: "lobby" | "active" | "closed";
  joining_open: boolean;
  vibe: string[];
  budget_hint: string | null;
  agent_tone: "efficient" | "warm" | "dry";
  preferred_trip_days: number;
  created_at: string;
};

export const TRIP_DURATION_PRESETS = [2, 3, 5, 7, 10, 14] as const;

export type MemberRow = {
  id: string;
  trip_id: string;
  display_name: string;
  email: string;
  role: "member" | "admin";
  status: "active" | "removed";
  device_token_hash: string | null;
  joined_at: string;
  nudge_tier: 0 | 1 | 2 | 3;
  flagged_at: string | null;
};

export type AgentName = "concierge" | "scribe" | "chaser" | "scout" | "planner" | "quartermaster";

export type ThreadRow = {
  id: string;
  trip_id: string;
  member_id: string;
  created_at: string;
};

export type MessageRow = {
  id: string;
  trip_id: string;
  lane: "group" | "thread";
  thread_id: string | null;
  author_type: "member" | "agent";
  author_id: string | null;
  agent_name: AgentName | null;
  body: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type FactCategory = "budget" | "departure_city" | "vibe" | "hard_no";

export type FactRow = {
  id: string;
  trip_id: string;
  member_id: string;
  category: FactCategory;
  type: "HARD" | "SOFT";
  value: unknown;
  confidence: number;
  source: "intake" | "manual" | "extract";
  source_message_id: string | null;
  superseded_by: string | null;
  created_at: string;
};

export type AvailabilityRow = {
  id: string;
  trip_id: string;
  member_id: string;
  start_date: string;
  end_date: string;
  strength: "free" | "partial" | "blocked";
  created_at: string;
};

export type DestinationOptionMeta = {
  costPerHead: string;
  travelTime: string;
  whyFits: string;
  whoFitsWorst: string;
};

export type DecisionOption = { id: string; label: string; meta?: DestinationOptionMeta };

export type DecisionType = "DATES" | "DESTINATION" | "BUDGET" | "STAY" | "ACTIVITY" | "CUSTOM";
export type DecisionState = "DRAFT" | "OPEN" | "VOTING" | "LOCKED" | "REOPENED";

export type DecisionRow = {
  id: string;
  trip_id: string;
  type: DecisionType;
  state: DecisionState;
  options: DecisionOption[];
  quorum_rule: string;
  deadline: string | null;
  default_on_silence: "none" | "flexible" | "leading_option";
  locked_option: string | null;
  rationale: string | null;
  locked_by: string | null;
  reminded_at: string | null;
  created_at: string;
};

export type DateOutreachNudgeRow = {
  id: string;
  decision_id: string;
  member_id: string;
  created_at: string;
};

export type VoteRow = {
  id: string;
  decision_id: string;
  member_id: string;
  option_id: string;
  is_veto: boolean;
  created_at: string;
};

export type ItineraryActivity = { time: string; description: string };
export type ItineraryDay = { day: number; date: string | null; title: string; activities: ItineraryActivity[] };

export type ItineraryRow = {
  id: string;
  trip_id: string;
  destination: string;
  days: ItineraryDay[];
  created_at: string;
  updated_at: string;
};

export type IdeaCategory = "activity" | "stay" | "travel";

export type IdeaRow = {
  id: string;
  trip_id: string;
  member_id: string;
  url: string | null;
  title: string | null;
  note: string | null;
  image_url: string | null;
  category: IdeaCategory;
  created_at: string;
};

export type IdeaVoteRow = {
  id: string;
  idea_id: string;
  member_id: string;
  created_at: string;
};

export type AccommodationRow = {
  id: string;
  trip_id: string;
  member_id: string;
  name: string;
  url: string | null;
  price: string | null;
  area: string | null;
  image_url: string | null;
  source: "chat" | "manual";
  locked: boolean;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
};

export type AccommodationVoteRow = {
  id: string;
  accommodation_id: string;
  member_id: string;
  created_at: string;
};

export type TravelMode = "air" | "road" | "water";

export type TravelOptionRow = {
  id: string;
  trip_id: string;
  member_id: string;
  name: string;
  mode: TravelMode;
  timing: string | null;
  price: string | null;
  url: string | null;
  source: "chat" | "manual";
  locked: boolean;
  created_at: string;
};

export type TravelOptionVoteRow = {
  id: string;
  travel_option_id: string;
  member_id: string;
  created_at: string;
};

export type TravelOptionMemberRow = {
  id: string;
  travel_option_id: string;
  member_id: string;
  created_at: string;
};

export type TaskCategory = "docs" | "booking" | "packing" | "other";

export type TaskRow = {
  id: string;
  trip_id: string;
  member_id: string | null;
  title: string;
  category: TaskCategory;
  due_date: string | null;
  done: boolean;
  created_at: string;
};

export type BookingRow = {
  id: string;
  trip_id: string;
  item: string;
  deadline: string | null;
  created_at: string;
};

export type BookingStatusRow = {
  id: string;
  booking_id: string;
  member_id: string;
  booked: boolean;
  updated_at: string;
};

export type CostEstimateRow = {
  id: string;
  trip_id: string;
  destination: string;
  min_per_head: number;
  max_per_head: number;
  currency: string;
  assumptions: string;
  created_at: string;
  updated_at: string;
};

export type BudgetCheckStatus = "pending" | "yes" | "no";

export type BudgetCheckRow = {
  id: string;
  trip_id: string;
  member_id: string;
  threshold_amount: number;
  status: BudgetCheckStatus;
  reason: string | null;
  created_at: string;
  answered_at: string | null;
};

export type AgentRunRow = {
  id: string;
  trip_id: string;
  agent: AgentName;
  trigger: string;
  input_tokens: number;
  output_tokens: number;
  cost: number;
  latency_ms: number;
  outcome: "success" | "error" | "skipped";
  error_message: string | null;
  created_at: string;
};
