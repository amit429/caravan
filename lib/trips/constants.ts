// A 1-2 person "group" barely needs a group-planning app — the lobby-gate
// rule exists so a trip only opens once there's actually a group to plan
// for. 3 total, admin included. Only gates the "start" transition, so trips
// already active before this rule existed are untouched.
export const MIN_MEMBERS_TO_OPEN = 3;
