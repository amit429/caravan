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
  created_at: string;
};

export type MemberRow = {
  id: string;
  trip_id: string;
  display_name: string;
  email: string;
  role: "member" | "admin";
  status: "active" | "removed";
  device_token_hash: string | null;
  joined_at: string;
};

export type MessageRow = {
  id: string;
  trip_id: string;
  lane: "group";
  author_type: "member";
  author_id: string | null;
  body: string;
  created_at: string;
};
