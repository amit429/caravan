import { describe, expect, it, vi, beforeEach } from "vitest";
import { ensureThread } from "./ensure-thread";

const mockSelectMaybeSingle = vi.fn();
const mockInsertSingle = vi.fn();
const mockRetrySingle = vi.fn();

function chainable(viaInsert: boolean) {
  const builder: Record<string, unknown> = {
    select: () => builder,
    eq: () => builder,
    insert: () => chainable(true),
    maybeSingle: () => mockSelectMaybeSingle(),
    single: () => (viaInsert ? mockInsertSingle() : mockRetrySingle()),
  };
  return builder;
}

const supabase = { from: () => chainable(false) } as unknown as Parameters<typeof ensureThread>[2];

beforeEach(() => {
  mockSelectMaybeSingle.mockReset();
  mockInsertSingle.mockReset();
  mockRetrySingle.mockReset();
});

describe("ensureThread", () => {
  it("returns the existing thread id without inserting", async () => {
    mockSelectMaybeSingle.mockResolvedValue({ data: { id: "thread-1" }, error: null });
    const id = await ensureThread("trip-1", "member-1", supabase);
    expect(id).toBe("thread-1");
  });

  it("creates a thread when none exists yet", async () => {
    mockSelectMaybeSingle.mockResolvedValue({ data: null, error: null });
    mockInsertSingle.mockResolvedValue({ data: { id: "thread-new" }, error: null });
    const id = await ensureThread("trip-1", "member-1", supabase);
    expect(id).toBe("thread-new");
  });

  it("falls back to a re-select when it loses a create race", async () => {
    mockSelectMaybeSingle.mockResolvedValue({ data: null, error: null });
    mockInsertSingle.mockResolvedValue({ data: null, error: { code: "23505" } });
    mockRetrySingle.mockResolvedValue({ data: { id: "thread-from-race" }, error: null });
    const id = await ensureThread("trip-1", "member-1", supabase);
    expect(id).toBe("thread-from-race");
  });
});
