import { describe, expect, it, vi, beforeEach } from "vitest";

const mockLogAgentRun = vi.fn();
const mockPostAgentMessage = vi.fn();
const mockDecisionsSelect = vi.fn();
const mockMembersSelect = vi.fn();
const mockAvailabilitySelect = vi.fn();
const mockTasksSelect = vi.fn();
const mockTasksInsert = vi.fn();

vi.mock("./log-run", () => ({ logAgentRun: (...args: unknown[]) => mockLogAgentRun(...args) }));
vi.mock("./post-agent-message", () => ({ postAgentMessage: (...args: unknown[]) => mockPostAgentMessage(...args) }));
vi.mock("@/lib/supabase/service", () => ({
  createServiceSupabaseClient: () => ({
    from: (table: string) => {
      if (table === "decisions") return { select: () => ({ eq: () => mockDecisionsSelect() }) };
      if (table === "members") return { select: () => ({ eq: () => ({ eq: () => mockMembersSelect() }) }) };
      if (table === "availability") return { select: () => ({ eq: () => mockAvailabilitySelect() }) };
      if (table === "tasks") {
        return {
          select: () => ({ eq: () => mockTasksSelect() }),
          insert: (rows: unknown) => mockTasksInsert(rows),
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  }),
}));

import { runQuartermaster } from "./quartermaster";

const lockedDestination = { type: "DESTINATION", state: "LOCKED", locked_option: "goa", options: [{ id: "goa", label: "Goa" }] };
const lockedDates = { type: "DATES", state: "LOCKED", locked_option: "window-0" };

beforeEach(() => {
  mockLogAgentRun.mockReset();
  mockPostAgentMessage.mockReset();
  mockDecisionsSelect.mockReset();
  mockMembersSelect.mockReset().mockResolvedValue({ data: [{ id: "m1" }, { id: "m2" }], error: null });
  mockAvailabilitySelect.mockReset().mockResolvedValue({ data: [], error: null });
  mockTasksSelect.mockReset().mockResolvedValue({ data: [], error: null });
  mockTasksInsert.mockReset().mockResolvedValue({ error: null });
});

describe("runQuartermaster", () => {
  it("refuses without a locked destination", async () => {
    mockDecisionsSelect.mockResolvedValue({ data: [lockedDates], error: null });
    const result = await runQuartermaster("trip-1");
    expect(result.ok).toBe(false);
    expect(mockTasksInsert).not.toHaveBeenCalled();
  });

  it("refuses without locked dates", async () => {
    mockDecisionsSelect.mockResolvedValue({ data: [lockedDestination], error: null });
    const result = await runQuartermaster("trip-1");
    expect(result.ok).toBe(false);
    expect(mockTasksInsert).not.toHaveBeenCalled();
  });

  it("refuses to regenerate once a checklist already exists", async () => {
    mockDecisionsSelect.mockResolvedValue({ data: [lockedDestination, lockedDates], error: null });
    mockTasksSelect.mockResolvedValue({ data: [{ id: "task-1" }], error: null });
    const result = await runQuartermaster("trip-1");
    expect(result).toEqual({ ok: false, reason: expect.stringContaining("already") });
    expect(mockTasksInsert).not.toHaveBeenCalled();
  });

  it("creates a per-member checklist plus a group task once destination and dates are locked", async () => {
    mockDecisionsSelect.mockResolvedValue({ data: [lockedDestination, lockedDates], error: null });

    const result = await runQuartermaster("trip-1");
    expect(result).toEqual({ ok: true });

    expect(mockTasksInsert).toHaveBeenCalledTimes(1);
    const rows = mockTasksInsert.mock.calls[0][0] as { trip_id: string; member_id: string | null; category: string }[];
    const perMember = rows.filter((r) => r.member_id !== null);
    const groupTasks = rows.filter((r) => r.member_id === null);
    expect(perMember.length).toBe(2 * 3); // 3 tasks x 2 members
    expect(groupTasks.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.trip_id === "trip-1")).toBe(true);

    expect(mockPostAgentMessage).toHaveBeenCalledWith(
      expect.objectContaining({ agentName: "quartermaster", body: expect.stringContaining("Checklist") })
    );
    expect(mockLogAgentRun).toHaveBeenCalledWith(expect.objectContaining({ agent: "quartermaster", outcome: "success" }));
  });
});
