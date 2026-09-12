# Caravan Phase 1 (Skeleton) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a deployed, demoable skeleton where an admin signs in with Google, creates a trip, gets an invite link, members join with just name+email, the admin starts the trip, and everyone sees the same async message board update in near-real-time. Zero AI, zero agents.

**Architecture:** Next.js 15 App Router + TypeScript, single repo, Supabase for Postgres/Auth/Realtime. Two-tier identity: Supabase Auth (Google OAuth) for the admin only; a custom signed JWT in an httpOnly cookie for members. All member-scoped and public (invite-code) data access goes through Next.js API routes using the Supabase **service role** key — RLS only ever grants the admin's own `auth.uid()`, so a leaked anon key exposes nothing.

**Tech Stack:** Next.js 15 (App Router), TypeScript, Tailwind v4, shadcn/ui, `@supabase/supabase-js`, `@supabase/ssr`, `jose` (JWT), `zod` (validation), Vitest (unit tests), Vercel (hosting).

**Spec:** `docs/superpowers/specs/2026-09-12-caravan-phase1-skeleton-design.md`

## Global Constraints

- Next.js 15 App Router, TypeScript strict mode, Tailwind v4, shadcn/ui — PRD §12.2.
- No LLM calls, no Inngest, no agent-authored messages, no threads, no facts/decisions/voting — this phase is F1/F2 plus a no-AI subset of F3 only (spec §2).
- Mobile-first: every screen is built and verified at 390×844 first (PRD D9).
- Members never get a Supabase Auth account. Their session is exclusively the signed JWT cookie (spec §3).
- RLS on `trips`/`members`/`messages` grants access only to `admin_user_id = auth.uid()`. No anon-role policies. All other reads/writes (join, post message, list messages) happen server-side with the service role key after verifying the JWT or the Supabase Auth session (spec §4).
- No one can insert into `messages` while `trips.status = 'lobby'` — enforced in the API route, not just hidden in the UI (spec §5, §8).
- Visual tokens (colors, type, radii) are taken verbatim from `docs/design/screens.html` (lines 11–28 for the CSS custom properties, lines 260–271 for the shared markup helpers). Copy/content for each screen is taken verbatim from the named `S('<flow>','<id>', ...)` block in that file, **except** that all agent-voice content (the `.agent` bubbles, "FILED" receipts, thread previews) is cut from D1/D2 for this phase — Scribe/Concierge don't exist yet. D1 becomes a single plain system line; D2 has only member messages and the composer, no receipts, no thread previews.
- Every task ends with a commit. Use the repo at `/Users/amitpile/personal-projects/Caravan - A trip planner everyone needs` (remote: `https://github.com/amit429/caravan`, branch `main`).
- Supabase project: `qnklzcugyjvtnadesbaf` (ref), region `ap-south-1`, URL `https://qnklzcugyjvtnadesbaf.supabase.co`. The `trips`/`members`/`messages` tables and their RLS policies already exist (applied via Supabase MCP) — Task 1 only adds the columns this plan needs that weren't in the original migration, and commits the migration file to the repo for reproducibility.

---

### Task 1: Scaffold Next.js app + commit reproducible schema migration

**Files:**
- Create: whole Next.js app at repo root via `create-next-app` (package.json, tsconfig.json, app/, etc.)
- Create: `supabase/migrations/0001_phase1_skeleton_schema.sql`
- Create: `supabase/migrations/0002_trip_vibe_tone_columns.sql`
- Create: `.env.example`
- Modify: `.gitignore` (already has `.next/`, `.vercel/`, `.env*.local` — add `.env`)

**Interfaces:**
- Produces: a running `npm run dev` Next.js 15 App Router project at the repo root, Tailwind v4 configured, TypeScript strict.

- [ ] **Step 1: Scaffold the app**

Run from the repo root:
```bash
npx create-next-app@latest . --typescript --tailwind --app --src-dir=false --import-alias "@/*" --eslint --no-turbopack --use-npm
```
Answer "Yes" if asked to use existing directory. If it refuses because the directory isn't empty, scaffold into a temp dir and merge: `npx create-next-app@latest /tmp/caravan-scaffold ...` then copy `app/`, `public/`, config files into the repo root, keeping the existing `docs/`, `.git/`, `.gitignore`, `.mcp.json`.

- [ ] **Step 2: Install runtime dependencies**

```bash
npm install @supabase/supabase-js @supabase/ssr jose zod
npm install -D vitest @vitejs/plugin-react
```

- [ ] **Step 3: Add Tailwind v4 design tokens**

Replace the contents of `app/globals.css` with:

```css
@import "tailwindcss";

@theme {
  --color-paper: #EDEAE3;
  --color-card: #FFFFFF;
  --color-sunk: #E4E0D6;
  --color-line: #D8D3C7;
  --color-ink: #17181C;
  --color-ink-2: #5A5C63;
  --color-ink-3: #9A9CA3;
  --color-plum: #5D2A5B;
  --color-plum-d: #46203F;
  --color-plum-t: #EFE2EE;
  --color-signal: #CBE83A;
  --color-signal-d: #8FA81C;
  --color-agent: #1B7A6B;
  --color-agent-t: #DCEFEB;
  --color-warn: #C98A06;
  --color-warn-t: #F7ECD2;
  --color-stop: #B93333;
  --color-stop-t: #F6DEDE;
  --color-m1: #5D2A5B;
  --color-m2: #1B7A6B;
  --color-m3: #2F5AA8;
  --color-m4: #B06A1C;
  --color-m5: #9C2B54;
  --color-m6: #4A6B22;
  --font-display: "Bricolage Grotesque", ui-sans-serif, system-ui, sans-serif;
  --font-ui: "Inter Tight", ui-sans-serif, system-ui, sans-serif;
  --font-mono: "DM Mono", ui-monospace, monospace;
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 18px;
  --radius-xl: 26px;
}

body {
  background: var(--color-paper);
  color: var(--color-ink);
  font-family: var(--font-ui);
}
```

- [ ] **Step 4: Add fonts in the root layout**

In `app/layout.tsx`, add inside `<head>` (Next.js App Router allows raw `<link>` tags in a Server Component layout):

```tsx
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
<link
  href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,600;12..96,700&family=Inter+Tight:wght@400;500;600&family=DM+Mono:wght@400;500&display=swap"
  rel="stylesheet"
/>
```

- [ ] **Step 5: Write `.env.example`**

```
NEXT_PUBLIC_SUPABASE_URL=https://qnklzcugyjvtnadesbaf.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
JWT_SECRET=
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

- [ ] **Step 6: Commit the reproducible migration for the schema already applied to the live project**

Create `supabase/migrations/0001_phase1_skeleton_schema.sql` with exactly this content (this mirrors what was already applied to project `qnklzcugyjvtnadesbaf` via the Supabase MCP — do not re-run it against that project, it's for reproducibility/local dev only):

```sql
create extension if not exists pgcrypto;

create table trips (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  rough_intent text,
  admin_user_id uuid not null references auth.users(id),
  invite_code text not null unique,
  status text not null default 'lobby' check (status in ('lobby','active','closed')),
  joining_open boolean not null default true,
  created_at timestamptz not null default now()
);

create table members (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  display_name text not null,
  email text not null,
  role text not null default 'member' check (role in ('member','admin')),
  status text not null default 'active' check (status in ('active','removed')),
  device_token_hash text,
  joined_at timestamptz not null default now(),
  unique (trip_id, email)
);

create table messages (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  lane text not null default 'group' check (lane = 'group'),
  author_type text not null check (author_type = 'member'),
  author_id uuid references members(id),
  body text not null,
  created_at timestamptz not null default now()
);

create index messages_trip_created_idx on messages(trip_id, created_at);
create index members_trip_idx on members(trip_id);

alter table trips enable row level security;
alter table members enable row level security;
alter table messages enable row level security;

create policy "admin manages own trips" on trips
  for all
  using (admin_user_id = auth.uid())
  with check (admin_user_id = auth.uid());

create policy "admin reads own trip members" on members
  for select
  using (exists (select 1 from trips where trips.id = members.trip_id and trips.admin_user_id = auth.uid()));

create policy "admin reads own trip messages" on messages
  for select
  using (exists (select 1 from trips where trips.id = messages.trip_id and trips.admin_user_id = auth.uid()));

alter publication supabase_realtime add table messages;
```

- [ ] **Step 7: Add and apply the second migration (new columns + members realtime) to the live project**

Create `supabase/migrations/0002_trip_vibe_tone_columns.sql`:

```sql
alter table trips
  add column vibe text[] not null default '{}',
  add column budget_hint text,
  add column agent_tone text not null default 'efficient' check (agent_tone in ('efficient','warm','dry'));

alter publication supabase_realtime add table members;
```

Apply it to the live project using the Supabase MCP `apply_migration` tool with `project_id: "qnklzcugyjvtnadesbaf"`, `name: "trip_vibe_tone_columns"`, and the SQL above (excluding the `alter publication` line if it errors because `messages` was already added in the same publication statement style — run the two statements as separate `apply_migration` calls if needed).

- [ ] **Step 8: Verify the app boots**

Run: `npm run dev` and confirm `http://localhost:3000` renders the default Next.js page with no console errors. Stop the server.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js 15 app, design tokens, schema migrations"
```

---

### Task 2: shadcn/ui setup

**Files:**
- Create: `components.json`, `lib/utils.ts`, `components/ui/button.tsx`, `components/ui/input.tsx`, `components/ui/textarea.tsx`

**Interfaces:**
- Produces: `Button`, `Input`, `Textarea` from `@/components/ui/*`, used by every screen task from Task 15 onward.

- [ ] **Step 1: Init shadcn**

```bash
npx shadcn@latest init -d
```
If prompted, choose: TypeScript yes, style "new-york", base color "neutral" (we override with our own tokens), CSS variables yes.

- [ ] **Step 2: Add the three primitives**

```bash
npx shadcn@latest add button input textarea
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: build succeeds with no type errors.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: add shadcn/ui button, input, textarea primitives"
```

---

### Task 3: Supabase clients

**Files:**
- Create: `lib/supabase/browser.ts`
- Create: `lib/supabase/server.ts`
- Create: `lib/supabase/service.ts`
- Create: `lib/database.types.ts`

**Interfaces:**
- Produces: `createBrowserSupabaseClient()` (browser, anon key, for admin OAuth), `createServerSupabaseClient()` (server component/route handler, anon key + cookies, for reading the admin's Supabase Auth session), `createServiceSupabaseClient()` (service role key, bypasses RLS, used by every API route in Tasks 9–13).

- [ ] **Step 1: Write hand-authored types for the three tables**

`lib/database.types.ts`:
```ts
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
```

- [ ] **Step 2: Browser client**

`lib/supabase/browser.ts`:
```ts
import { createBrowserClient } from "@supabase/ssr";

export function createBrowserSupabaseClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

- [ ] **Step 3: Server client (reads/writes the admin's auth cookie)**

`lib/supabase/server.ts`:
```ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createServerSupabaseClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // called from a Server Component with no response to write to; ignore
          }
        },
      },
    }
  );
}
```

- [ ] **Step 4: Service-role client**

`lib/supabase/service.ts`:
```ts
import { createClient } from "@supabase/supabase-js";

export function createServiceSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}
```

- [ ] **Step 5: Verify build**

Run: `npm run build`
Expected: succeeds (these files are unused so far, but must type-check).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add Supabase browser/server/service clients"
```

---

### Task 4: Invite code generator

**Files:**
- Create: `lib/invite-code.ts`
- Test: `lib/invite-code.test.ts`
- Create: `vitest.config.ts`

**Interfaces:**
- Produces: `generateInviteCode(): string` — 6 uppercase alphanumeric characters, excluding visually ambiguous characters (`0`, `O`, `1`, `I`, `L`).
- Consumed by: Task 9 (trip creation).

- [ ] **Step 1: Vitest config**

`vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
  },
});
```

Add to `package.json` scripts: `"test": "vitest run"`.

- [ ] **Step 2: Write the failing test**

`lib/invite-code.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { generateInviteCode } from "./invite-code";

describe("generateInviteCode", () => {
  it("returns 6 characters", () => {
    expect(generateInviteCode()).toHaveLength(6);
  });

  it("only uses unambiguous uppercase alphanumerics", () => {
    const code = generateInviteCode();
    expect(code).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/);
  });

  it("is not deterministic across calls", () => {
    const codes = new Set(Array.from({ length: 20 }, () => generateInviteCode()));
    expect(codes.size).toBeGreaterThan(1);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run lib/invite-code.test.ts`
Expected: FAIL — `Cannot find module './invite-code'`

- [ ] **Step 4: Implement**

`lib/invite-code.ts`:
```ts
import { randomInt } from "node:crypto";

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function generateInviteCode(): string {
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += ALPHABET[randomInt(ALPHABET.length)];
  }
  return code;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run lib/invite-code.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add invite code generator with tests"
```

---

### Task 5: Member JWT sign/verify

**Files:**
- Create: `lib/auth/member-jwt.ts`
- Test: `lib/auth/member-jwt.test.ts`

**Interfaces:**
- Produces: `signMemberToken({ tripId, memberId }: { tripId: string; memberId: string }): Promise<string>` and `verifyMemberToken(token: string): Promise<{ tripId: string; memberId: string } | null>` (returns `null` on any invalid/expired/malformed token, never throws).
- Consumed by: Task 11 (join route, sets the cookie), Task 8 (session helper reads it), Task 12–13 (member-authenticated routes).

- [ ] **Step 1: Write the failing test**

`lib/auth/member-jwt.test.ts`:
```ts
import { describe, expect, it, beforeAll } from "vitest";
import { signMemberToken, verifyMemberToken } from "./member-jwt";

beforeAll(() => {
  process.env.JWT_SECRET = "test-secret-at-least-32-bytes-long!!";
});

describe("member JWT", () => {
  it("round-trips tripId and memberId", async () => {
    const token = await signMemberToken({ tripId: "trip-1", memberId: "member-1" });
    const claims = await verifyMemberToken(token);
    expect(claims).toEqual({ tripId: "trip-1", memberId: "member-1" });
  });

  it("returns null for a garbage token", async () => {
    expect(await verifyMemberToken("not-a-jwt")).toBeNull();
  });

  it("returns null for a token signed with a different secret", async () => {
    const token = await signMemberToken({ tripId: "trip-1", memberId: "member-1" });
    process.env.JWT_SECRET = "a-completely-different-secret-value";
    expect(await verifyMemberToken(token)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/auth/member-jwt.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement**

`lib/auth/member-jwt.ts`:
```ts
import { SignJWT, jwtVerify } from "jose";

const ONE_HUNDRED_EIGHTY_DAYS = 60 * 60 * 24 * 180;

function getSecretKey() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not set");
  return new TextEncoder().encode(secret);
}

export async function signMemberToken({
  tripId,
  memberId,
}: {
  tripId: string;
  memberId: string;
}): Promise<string> {
  return new SignJWT({ tripId, memberId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${ONE_HUNDRED_EIGHTY_DAYS}s`)
    .sign(getSecretKey());
}

export async function verifyMemberToken(
  token: string
): Promise<{ tripId: string; memberId: string } | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    if (typeof payload.tripId !== "string" || typeof payload.memberId !== "string") {
      return null;
    }
    return { tripId: payload.tripId, memberId: payload.memberId };
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/auth/member-jwt.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add member JWT sign/verify with tests"
```

---

### Task 6: Validation schemas

**Files:**
- Create: `lib/validation.ts`
- Test: `lib/validation.test.ts`

**Interfaces:**
- Produces: `createTripSchema`, `joinTripSchema` (both Zod schemas), exported types `CreateTripInput`, `JoinTripInput`.
- Consumed by: Task 9 (`POST /api/trips`), Task 11 (`POST /api/join/[code]`).

- [ ] **Step 1: Write the failing test**

`lib/validation.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { createTripSchema, joinTripSchema } from "./validation";

describe("createTripSchema", () => {
  it("accepts a minimal valid trip", () => {
    const result = createTripSchema.safeParse({ name: "Goa, probably" });
    expect(result.success).toBe(true);
  });

  it("rejects an empty name", () => {
    const result = createTripSchema.safeParse({ name: "" });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid agent_tone", () => {
    const result = createTripSchema.safeParse({ name: "Goa", agentTone: "sarcastic" });
    expect(result.success).toBe(false);
  });
});

describe("joinTripSchema", () => {
  it("accepts a valid name and email", () => {
    const result = joinTripSchema.safeParse({ displayName: "Ishaan", email: "ishaan@example.com" });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid email", () => {
    const result = joinTripSchema.safeParse({ displayName: "Ishaan", email: "not-an-email" });
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/validation.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement**

`lib/validation.ts`:
```ts
import { z } from "zod";

export const createTripSchema = z.object({
  name: z.string().trim().min(1).max(80),
  roughIntent: z.string().trim().max(280).optional(),
  vibe: z.array(z.string()).max(12).optional().default([]),
  budgetHint: z.string().trim().max(40).optional(),
  agentTone: z.enum(["efficient", "warm", "dry"]).optional().default("efficient"),
});
export type CreateTripInput = z.infer<typeof createTripSchema>;

export const joinTripSchema = z.object({
  displayName: z.string().trim().min(1).max(60),
  email: z.string().trim().email().max(120),
});
export type JoinTripInput = z.infer<typeof joinTripSchema>;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/validation.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add zod validation schemas for trip creation and join"
```

---

### Task 7: Session helpers

**Files:**
- Create: `lib/auth/session.ts`

**Interfaces:**
- Consumes: `createServerSupabaseClient` (Task 3), `verifyMemberToken` (Task 5).
- Produces: `getAdminUser(): Promise<{ id: string; email: string } | null>`, `getMemberSession(): Promise<{ tripId: string; memberId: string } | null>` — both read from Next.js `cookies()`, both used by every API route from Task 9 onward.

- [ ] **Step 1: Implement**

`lib/auth/session.ts`:
```ts
import { cookies } from "next/headers";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { verifyMemberToken } from "@/lib/auth/member-jwt";

export const MEMBER_TOKEN_COOKIE = "caravan_member_token";

export async function getAdminUser(): Promise<{ id: string; email: string } | null> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !user.email) return null;
  return { id: user.id, email: user.email };
}

export async function getMemberSession(): Promise<{ tripId: string; memberId: string } | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(MEMBER_TOKEN_COOKIE)?.value;
  if (!token) return null;
  return verifyMemberToken(token);
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: add admin/member session helpers"
```

---

### Task 8: `POST /api/trips` — create trip (admin only)

**Files:**
- Create: `app/api/trips/route.ts`
- Test: `app/api/trips/route.test.ts`

**Interfaces:**
- Consumes: `getAdminUser` (Task 7), `createServiceSupabaseClient` (Task 3), `generateInviteCode` (Task 4), `createTripSchema` (Task 6).
- Produces: `POST /api/trips` → `201 { trip: TripRow }` on success. Creates the trip **and** a mirrored `members` row for the admin (`role: 'admin'`, `status: 'active'`) so the member list renders the admin uniformly (spec §4 / mockup A7 shows "Amit — you, admin" in the same list as members).

- [ ] **Step 1: Write the failing test**

`app/api/trips/route.test.ts` — mock the session and Supabase service client:
```ts
import { describe, expect, it, vi, beforeEach } from "vitest";

const mockGetAdminUser = vi.fn();
const mockInsertTrip = vi.fn();
const mockInsertMember = vi.fn();

vi.mock("@/lib/auth/session", () => ({
  getAdminUser: () => mockGetAdminUser(),
}));

vi.mock("@/lib/supabase/service", () => ({
  createServiceSupabaseClient: () => ({
    from: (table: string) => {
      if (table === "trips") {
        return {
          insert: (row: unknown) => ({
            select: () => ({
              single: () => mockInsertTrip(row),
            }),
          }),
        };
      }
      if (table === "members") {
        return { insert: (row: unknown) => mockInsertMember(row) };
      }
      throw new Error(`unexpected table ${table}`);
    },
  }),
}));

import { POST } from "./route";

beforeEach(() => {
  mockGetAdminUser.mockReset();
  mockInsertTrip.mockReset();
  mockInsertMember.mockReset();
  mockInsertMember.mockResolvedValue({ error: null });
});

describe("POST /api/trips", () => {
  it("rejects unauthenticated requests", async () => {
    mockGetAdminUser.mockResolvedValue(null);
    const req = new Request("http://localhost/api/trips", {
      method: "POST",
      body: JSON.stringify({ name: "Goa" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("rejects an invalid body", async () => {
    mockGetAdminUser.mockResolvedValue({ id: "admin-1", email: "amit@example.com" });
    const req = new Request("http://localhost/api/trips", {
      method: "POST",
      body: JSON.stringify({ name: "" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("creates a trip and mirrors the admin as a member", async () => {
    mockGetAdminUser.mockResolvedValue({ id: "admin-1", email: "amit@example.com" });
    mockInsertTrip.mockResolvedValue({
      data: { id: "trip-1", name: "Goa", admin_user_id: "admin-1", invite_code: "ABCDEF" },
      error: null,
    });
    const req = new Request("http://localhost/api/trips", {
      method: "POST",
      body: JSON.stringify({ name: "Goa, probably" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.trip.id).toBe("trip-1");
    expect(mockInsertMember).toHaveBeenCalledWith(
      expect.objectContaining({
        trip_id: "trip-1",
        email: "amit@example.com",
        role: "admin",
      })
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/api/trips/route.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement**

`app/api/trips/route.ts`:
```ts
import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/auth/session";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { generateInviteCode } from "@/lib/invite-code";
import { createTripSchema } from "@/lib/validation";

export async function POST(request: Request) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = createTripSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = createServiceSupabaseClient();

  let trip = null;
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 5 && !trip; attempt++) {
    const { data, error } = await supabase
      .from("trips")
      .insert({
        name: parsed.data.name,
        rough_intent: parsed.data.roughIntent ?? null,
        admin_user_id: admin.id,
        invite_code: generateInviteCode(),
        vibe: parsed.data.vibe,
        budget_hint: parsed.data.budgetHint ?? null,
        agent_tone: parsed.data.agentTone,
      })
      .select()
      .single();
    if (error) {
      lastError = error;
      continue; // likely a unique-constraint collision on invite_code; retry with a new code
    }
    trip = data;
  }

  if (!trip) {
    console.error("failed to create trip after retries", lastError);
    return NextResponse.json({ error: "could_not_create_trip" }, { status: 500 });
  }

  const { error: memberError } = await supabase.from("members").insert({
    trip_id: trip.id,
    display_name: admin.email.split("@")[0],
    email: admin.email,
    role: "admin",
    status: "active",
  });
  if (memberError) {
    console.error("failed to mirror admin as member", memberError);
  }

  return NextResponse.json({ trip }, { status: 201 });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run app/api/trips/route.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add POST /api/trips with admin auth and retrying invite codes"
```

---

### Task 9: `GET /api/trips` (list) + `PATCH /api/trips/[tripId]` (start / toggle joining)

**Files:**
- Create: `app/api/trips/route.ts` (add `GET` alongside existing `POST`)
- Create: `app/api/trips/[tripId]/route.ts`
- Test: `app/api/trips/[tripId]/route.test.ts`

**Interfaces:**
- Consumes: `getAdminUser` (Task 7), `createServiceSupabaseClient` (Task 3).
- Produces: `GET /api/trips` → `200 { trips: TripRow[] }` for the signed-in admin (A3). `PATCH /api/trips/[tripId]` body `{ action: "start" }` → sets `status` to `active` only if currently `lobby`, else `409`. Body `{ action: "toggle_joining" }` → flips `joining_open`. Both require the trip's `admin_user_id` to match the caller.

- [ ] **Step 1: Write the failing test**

`app/api/trips/[tripId]/route.test.ts`:
```ts
import { describe, expect, it, vi, beforeEach } from "vitest";

const mockGetAdminUser = vi.fn();
const mockSingle = vi.fn();
const mockUpdate = vi.fn();

vi.mock("@/lib/auth/session", () => ({
  getAdminUser: () => mockGetAdminUser(),
}));

vi.mock("@/lib/supabase/service", () => ({
  createServiceSupabaseClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          single: () => mockSingle(),
        }),
      }),
      update: (patch: unknown) => ({
        eq: () => ({
          select: () => ({
            single: () => mockUpdate(patch),
          }),
        }),
      }),
    }),
  }),
}));

import { PATCH } from "./route";

beforeEach(() => {
  mockGetAdminUser.mockReset();
  mockSingle.mockReset();
  mockUpdate.mockReset();
});

function patchRequest(action: string) {
  return new Request("http://localhost/api/trips/trip-1", {
    method: "PATCH",
    body: JSON.stringify({ action }),
  });
}

describe("PATCH /api/trips/[tripId]", () => {
  it("rejects a non-owning admin", async () => {
    mockGetAdminUser.mockResolvedValue({ id: "admin-2", email: "x@example.com" });
    mockSingle.mockResolvedValue({ data: { id: "trip-1", admin_user_id: "admin-1", status: "lobby" }, error: null });
    const res = await PATCH(patchRequest("start"), { params: Promise.resolve({ tripId: "trip-1" }) });
    expect(res.status).toBe(403);
  });

  it("rejects starting a trip that's already active", async () => {
    mockGetAdminUser.mockResolvedValue({ id: "admin-1", email: "x@example.com" });
    mockSingle.mockResolvedValue({ data: { id: "trip-1", admin_user_id: "admin-1", status: "active" }, error: null });
    const res = await PATCH(patchRequest("start"), { params: Promise.resolve({ tripId: "trip-1" }) });
    expect(res.status).toBe(409);
  });

  it("starts a lobby trip", async () => {
    mockGetAdminUser.mockResolvedValue({ id: "admin-1", email: "x@example.com" });
    mockSingle.mockResolvedValue({ data: { id: "trip-1", admin_user_id: "admin-1", status: "lobby" }, error: null });
    mockUpdate.mockResolvedValue({ data: { id: "trip-1", status: "active" }, error: null });
    const res = await PATCH(patchRequest("start"), { params: Promise.resolve({ tripId: "trip-1" }) });
    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ status: "active" }));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run "app/api/trips/[tripId]/route.test.ts"`
Expected: FAIL — module not found

- [ ] **Step 3: Implement `GET` on `app/api/trips/route.ts`**

Add to the existing file from Task 8:
```ts
export async function GET() {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  const supabase = createServiceSupabaseClient();
  const { data, error } = await supabase
    .from("trips")
    .select()
    .eq("admin_user_id", admin.id)
    .order("created_at", { ascending: false });
  if (error) {
    return NextResponse.json({ error: "could_not_list_trips" }, { status: 500 });
  }
  return NextResponse.json({ trips: data });
}
```

- [ ] **Step 4: Implement `app/api/trips/[tripId]/route.ts`**

```ts
import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/auth/session";
import { createServiceSupabaseClient } from "@/lib/supabase/service";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ tripId: string }> }
) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  const { tripId } = await params;
  const { action } = await request.json();

  const supabase = createServiceSupabaseClient();
  const { data: trip, error: fetchError } = await supabase
    .from("trips")
    .select()
    .eq("id", tripId)
    .single();
  if (fetchError || !trip) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (trip.admin_user_id !== admin.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  if (action === "start") {
    if (trip.status !== "lobby") {
      return NextResponse.json({ error: "trip_not_in_lobby" }, { status: 409 });
    }
    const { data, error } = await supabase
      .from("trips")
      .update({ status: "active" })
      .eq("id", tripId)
      .select()
      .single();
    if (error) return NextResponse.json({ error: "update_failed" }, { status: 500 });
    return NextResponse.json({ trip: data });
  }

  if (action === "toggle_joining") {
    const { data, error } = await supabase
      .from("trips")
      .update({ joining_open: !trip.joining_open })
      .eq("id", tripId)
      .select()
      .single();
    if (error) return NextResponse.json({ error: "update_failed" }, { status: 500 });
    return NextResponse.json({ trip: data });
  }

  return NextResponse.json({ error: "unknown_action" }, { status: 400 });
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run "app/api/trips/[tripId]/route.test.ts"`
Expected: PASS (3 tests)

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add trip listing and start/toggle-joining routes"
```

---

### Task 10: `GET`/`POST /api/join/[code]` — invite preview and join

**Files:**
- Create: `app/api/join/[code]/route.ts`
- Test: `app/api/join/[code]/route.test.ts`

**Interfaces:**
- Consumes: `createServiceSupabaseClient` (Task 3), `joinTripSchema` (Task 6), `signMemberToken` (Task 5), `MEMBER_TOKEN_COOKIE` (Task 7).
- Produces: `GET /api/join/[code]` → `200 { trip: { name, roughIntent, memberCount }, joinable: boolean }` (public, no auth — powers B1). `POST /api/join/[code]` → validates body, upserts the `members` row (resume-by-email per spec §3), sets the `caravan_member_token` httpOnly cookie, returns `200 { member: MemberRow }`.

- [ ] **Step 1: Write the failing test**

`app/api/join/[code]/route.test.ts`:
```ts
import { describe, expect, it, vi, beforeEach } from "vitest";

const mockTripSingle = vi.fn();
const mockMemberMaybeSingle = vi.fn();
const mockMemberInsertSingle = vi.fn();

vi.mock("@/lib/supabase/service", () => ({
  createServiceSupabaseClient: () => ({
    from: (table: string) => {
      if (table === "trips") {
        return { select: () => ({ eq: () => ({ single: () => mockTripSingle() }) }) };
      }
      if (table === "members") {
        return {
          select: () => ({
            eq: () => ({ eq: () => ({ maybeSingle: () => mockMemberMaybeSingle() }) }),
          }),
          insert: () => ({ select: () => ({ single: () => mockMemberInsertSingle() }) }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  }),
}));

vi.mock("@/lib/auth/member-jwt", () => ({
  signMemberToken: vi.fn().mockResolvedValue("signed-token"),
}));

import { POST } from "./route";

beforeEach(() => {
  mockTripSingle.mockReset();
  mockMemberMaybeSingle.mockReset();
  mockMemberInsertSingle.mockReset();
});

function joinRequest(body: unknown) {
  return new Request("http://localhost/api/join/ABCDEF", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/join/[code]", () => {
  it("404s for an unknown invite code", async () => {
    mockTripSingle.mockResolvedValue({ data: null, error: { message: "not found" } });
    const res = await POST(joinRequest({ displayName: "Ishaan", email: "i@example.com" }), {
      params: Promise.resolve({ code: "ABCDEF" }),
    });
    expect(res.status).toBe(404);
  });

  it("409s when joining is closed", async () => {
    mockTripSingle.mockResolvedValue({
      data: { id: "trip-1", joining_open: false },
      error: null,
    });
    const res = await POST(joinRequest({ displayName: "Ishaan", email: "i@example.com" }), {
      params: Promise.resolve({ code: "ABCDEF" }),
    });
    expect(res.status).toBe(409);
  });

  it("resumes an existing member by email instead of creating a duplicate", async () => {
    mockTripSingle.mockResolvedValue({ data: { id: "trip-1", joining_open: true }, error: null });
    mockMemberMaybeSingle.mockResolvedValue({
      data: { id: "member-1", trip_id: "trip-1", email: "i@example.com" },
      error: null,
    });
    const res = await POST(joinRequest({ displayName: "Ishaan", email: "i@example.com" }), {
      params: Promise.resolve({ code: "ABCDEF" }),
    });
    expect(res.status).toBe(200);
    expect(mockMemberInsertSingle).not.toHaveBeenCalled();
    const setCookie = res.headers.get("set-cookie");
    expect(setCookie).toContain("caravan_member_token=signed-token");
  });

  it("creates a new member when the email hasn't joined yet", async () => {
    mockTripSingle.mockResolvedValue({ data: { id: "trip-1", joining_open: true }, error: null });
    mockMemberMaybeSingle.mockResolvedValue({ data: null, error: null });
    mockMemberInsertSingle.mockResolvedValue({
      data: { id: "member-2", trip_id: "trip-1", email: "new@example.com" },
      error: null,
    });
    const res = await POST(joinRequest({ displayName: "New", email: "new@example.com" }), {
      params: Promise.resolve({ code: "ABCDEF" }),
    });
    expect(res.status).toBe(200);
    expect(mockMemberInsertSingle).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run "app/api/join/[code]/route.test.ts"`
Expected: FAIL — module not found

- [ ] **Step 3: Implement**

`app/api/join/[code]/route.ts`:
```ts
import { NextResponse } from "next/server";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { joinTripSchema } from "@/lib/validation";
import { signMemberToken } from "@/lib/auth/member-jwt";
import { MEMBER_TOKEN_COOKIE } from "@/lib/auth/session";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const supabase = createServiceSupabaseClient();
  const { data: trip, error } = await supabase
    .from("trips")
    .select("name, rough_intent, joining_open, status")
    .eq("invite_code", code)
    .single();
  if (error || !trip) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const { count } = await supabase
    .from("members")
    .select("*", { count: "exact", head: true })
    .eq("invite_code", code);
  return NextResponse.json({
    trip: { name: trip.name, roughIntent: trip.rough_intent, memberCount: count ?? 0 },
    joinable: trip.joining_open && trip.status !== "closed",
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const body = await request.json();
  const parsed = joinTripSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = createServiceSupabaseClient();
  const { data: trip, error: tripError } = await supabase
    .from("trips")
    .select("id, joining_open")
    .eq("invite_code", code)
    .single();
  if (tripError || !trip) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (!trip.joining_open) {
    return NextResponse.json({ error: "joining_closed" }, { status: 409 });
  }

  const { data: existingMember } = await supabase
    .from("members")
    .select()
    .eq("trip_id", trip.id)
    .eq("email", parsed.data.email)
    .maybeSingle();

  const member =
    existingMember ??
    (
      await supabase
        .from("members")
        .insert({
          trip_id: trip.id,
          display_name: parsed.data.displayName,
          email: parsed.data.email,
        })
        .select()
        .single()
    ).data;

  if (!member) {
    return NextResponse.json({ error: "could_not_join" }, { status: 500 });
  }

  const token = await signMemberToken({ tripId: trip.id, memberId: member.id });
  const response = NextResponse.json({ member });
  response.cookies.set(MEMBER_TOKEN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 180,
  });
  return response;
}
```

Note: fix the `GET` handler's member-count query — `members` has no `invite_code` column, it must join through `trip_id`. Replace that query with:
```ts
  const { data: tripWithId } = await supabase
    .from("trips")
    .select("id")
    .eq("invite_code", code)
    .single();
  const { count } = await supabase
    .from("members")
    .select("*", { count: "exact", head: true })
    .eq("trip_id", tripWithId?.id ?? "");
```
(Fold this into the single `GET` implementation above rather than querying by invite_code twice — select `id, name, rough_intent, joining_open, status` from `trips` in one call, then use `trip.id` for the `members` count query.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run "app/api/join/[code]/route.test.ts"`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add invite preview and join routes with resume-by-email"
```

---

### Task 11: `GET`/`POST /api/trips/[tripId]/messages`

**Files:**
- Create: `app/api/trips/[tripId]/messages/route.ts`
- Test: `app/api/trips/[tripId]/messages/route.test.ts`

**Interfaces:**
- Consumes: `getAdminUser`, `getMemberSession` (Task 7), `createServiceSupabaseClient` (Task 3).
- Produces: `GET` → `200 { messages: MessageRow[] }` for any caller (admin or member) belonging to the trip. `POST` body `{ body: string }` → `201 { message: MessageRow }`, `403` if the caller isn't a member/admin of this trip, `409` if `trips.status !== 'active'` (spec §5/§8).

- [ ] **Step 1: Write the failing test**

`app/api/trips/[tripId]/messages/route.test.ts`:
```ts
import { describe, expect, it, vi, beforeEach } from "vitest";

const mockGetAdminUser = vi.fn();
const mockGetMemberSession = vi.fn();
const mockTripSingle = vi.fn();
const mockMemberMaybeSingle = vi.fn();
const mockInsertSingle = vi.fn();

vi.mock("@/lib/auth/session", () => ({
  getAdminUser: () => mockGetAdminUser(),
  getMemberSession: () => mockGetMemberSession(),
}));

vi.mock("@/lib/supabase/service", () => ({
  createServiceSupabaseClient: () => ({
    from: (table: string) => {
      if (table === "trips") {
        return { select: () => ({ eq: () => ({ single: () => mockTripSingle() }) }) };
      }
      if (table === "members") {
        return {
          select: () => ({
            eq: () => ({ eq: () => ({ maybeSingle: () => mockMemberMaybeSingle() }) }),
          }),
        };
      }
      if (table === "messages") {
        return { insert: (row: unknown) => ({ select: () => ({ single: () => mockInsertSingle(row) }) }) };
      }
      throw new Error(`unexpected table ${table}`);
    },
  }),
}));

import { POST } from "./route";

beforeEach(() => {
  mockGetAdminUser.mockReset();
  mockGetMemberSession.mockReset();
  mockTripSingle.mockReset();
  mockMemberMaybeSingle.mockReset();
  mockInsertSingle.mockReset();
});

function postRequest(body: unknown) {
  return new Request("http://localhost/api/trips/trip-1/messages", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/trips/[tripId]/messages", () => {
  it("rejects a caller with neither admin nor member session", async () => {
    mockGetAdminUser.mockResolvedValue(null);
    mockGetMemberSession.mockResolvedValue(null);
    const res = await POST(postRequest({ body: "hi" }), { params: Promise.resolve({ tripId: "trip-1" }) });
    expect(res.status).toBe(401);
  });

  it("blocks posting while the trip is still in the lobby", async () => {
    mockGetAdminUser.mockResolvedValue(null);
    mockGetMemberSession.mockResolvedValue({ tripId: "trip-1", memberId: "member-1" });
    mockMemberMaybeSingle.mockResolvedValue({ data: { id: "member-1", status: "active" }, error: null });
    mockTripSingle.mockResolvedValue({ data: { id: "trip-1", status: "lobby" }, error: null });
    const res = await POST(postRequest({ body: "hi" }), { params: Promise.resolve({ tripId: "trip-1" }) });
    expect(res.status).toBe(409);
  });

  it("returns 403 for a removed member instead of posting", async () => {
    mockGetAdminUser.mockResolvedValue(null);
    mockGetMemberSession.mockResolvedValue({ tripId: "trip-1", memberId: "member-1" });
    mockMemberMaybeSingle.mockResolvedValue({ data: { id: "member-1", status: "removed" }, error: null });
    const res = await POST(postRequest({ body: "hi" }), { params: Promise.resolve({ tripId: "trip-1" }) });
    expect(res.status).toBe(403);
  });

  it("posts a message once the trip is active", async () => {
    mockGetAdminUser.mockResolvedValue(null);
    mockGetMemberSession.mockResolvedValue({ tripId: "trip-1", memberId: "member-1" });
    mockMemberMaybeSingle.mockResolvedValue({ data: { id: "member-1", status: "active" }, error: null });
    mockTripSingle.mockResolvedValue({ data: { id: "trip-1", status: "active" }, error: null });
    mockInsertSingle.mockResolvedValue({
      data: { id: "msg-1", trip_id: "trip-1", body: "hi", author_id: "member-1" },
      error: null,
    });
    const res = await POST(postRequest({ body: "hi" }), { params: Promise.resolve({ tripId: "trip-1" }) });
    expect(res.status).toBe(201);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run "app/api/trips/[tripId]/messages/route.test.ts"`
Expected: FAIL — module not found

- [ ] **Step 3: Implement**

`app/api/trips/[tripId]/messages/route.ts`:
```ts
import { NextResponse } from "next/server";
import { getAdminUser, getMemberSession } from "@/lib/auth/session";
import { createServiceSupabaseClient } from "@/lib/supabase/service";

type CallerLookup = { id: string; status: "active" | "removed" } | null;

async function resolveCaller(
  tripId: string,
  supabase: ReturnType<typeof createServiceSupabaseClient>
): Promise<CallerLookup> {
  const admin = await getAdminUser();
  if (admin) {
    const { data } = await supabase
      .from("members")
      .select("id, status")
      .eq("trip_id", tripId)
      .eq("email", admin.email)
      .maybeSingle();
    return data ?? null;
  }
  const memberSession = await getMemberSession();
  if (memberSession && memberSession.tripId === tripId) {
    const { data } = await supabase
      .from("members")
      .select("id, status")
      .eq("trip_id", tripId)
      .eq("id", memberSession.memberId)
      .maybeSingle();
    return data ?? null;
  }
  return null;
}

// 401 = no session at all (never joined / never signed in). 403 = a real member/admin
// row exists but was removed by the admin — this is how a removed member's client
// learns to clear its cookie (spec §8).
function callerAuthError(caller: CallerLookup) {
  if (!caller) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (caller.status === "removed") return NextResponse.json({ error: "removed" }, { status: 403 });
  return null;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ tripId: string }> }
) {
  const { tripId } = await params;
  const supabase = createServiceSupabaseClient();
  const caller = await resolveCaller(tripId, supabase);
  const authError = callerAuthError(caller);
  if (authError) return authError;
  const { data, error } = await supabase
    .from("messages")
    .select()
    .eq("trip_id", tripId)
    .order("created_at", { ascending: true });
  if (error) return NextResponse.json({ error: "could_not_list_messages" }, { status: 500 });
  return NextResponse.json({ messages: data });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tripId: string }> }
) {
  const { tripId } = await params;
  const supabase = createServiceSupabaseClient();
  const caller = await resolveCaller(tripId, supabase);
  const authError = callerAuthError(caller);
  if (authError) return authError;
  const callerMemberId = caller!.id;

  const { data: trip } = await supabase.from("trips").select("id, status").eq("id", tripId).single();
  if (!trip) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (trip.status !== "active") {
    return NextResponse.json({ error: "trip_not_active" }, { status: 409 });
  }

  const { body } = await request.json();
  if (typeof body !== "string" || body.trim().length === 0 || body.length > 2000) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const { data: message, error } = await supabase
    .from("messages")
    .insert({
      trip_id: tripId,
      lane: "group",
      author_type: "member",
      author_id: callerMemberId,
      body: body.trim(),
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: "could_not_post_message" }, { status: 500 });
  return NextResponse.json({ message }, { status: 201 });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run "app/api/trips/[tripId]/messages/route.test.ts"`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add message list/post routes with lobby-gate and dual auth"
```

---

### Task 12: `POST /api/trips/[tripId]/members/[memberId]/remove`

**Files:**
- Create: `app/api/trips/[tripId]/members/[memberId]/remove/route.ts`
- Test: `app/api/trips/[tripId]/members/[memberId]/remove/route.test.ts`

**Interfaces:**
- Consumes: `getAdminUser` (Task 7), `createServiceSupabaseClient` (Task 3).
- Produces: `POST` → sets `members.status = 'removed'`, admin-of-this-trip only.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it, vi, beforeEach } from "vitest";

const mockGetAdminUser = vi.fn();
const mockTripSingle = vi.fn();
const mockUpdate = vi.fn();

vi.mock("@/lib/auth/session", () => ({ getAdminUser: () => mockGetAdminUser() }));
vi.mock("@/lib/supabase/service", () => ({
  createServiceSupabaseClient: () => ({
    from: () => ({
      select: () => ({ eq: () => ({ single: () => mockTripSingle() }) }),
      update: (patch: unknown) => ({ eq: () => mockUpdate(patch) }),
    }),
  }),
}));

import { POST } from "./route";

beforeEach(() => {
  mockGetAdminUser.mockReset();
  mockTripSingle.mockReset();
  mockUpdate.mockReset();
  mockUpdate.mockResolvedValue({ error: null });
});

describe("POST /api/trips/[tripId]/members/[memberId]/remove", () => {
  it("rejects a non-owning admin", async () => {
    mockGetAdminUser.mockResolvedValue({ id: "admin-2" });
    mockTripSingle.mockResolvedValue({ data: { admin_user_id: "admin-1" }, error: null });
    const res = await POST(new Request("http://localhost", { method: "POST" }), {
      params: Promise.resolve({ tripId: "trip-1", memberId: "member-1" }),
    });
    expect(res.status).toBe(403);
  });

  it("marks the member removed for the owning admin", async () => {
    mockGetAdminUser.mockResolvedValue({ id: "admin-1" });
    mockTripSingle.mockResolvedValue({ data: { admin_user_id: "admin-1" }, error: null });
    const res = await POST(new Request("http://localhost", { method: "POST" }), {
      params: Promise.resolve({ tripId: "trip-1", memberId: "member-1" }),
    });
    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith({ status: "removed" });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run "app/api/trips/[tripId]/members/[memberId]/remove/route.test.ts"`
Expected: FAIL — module not found

- [ ] **Step 3: Implement**

`app/api/trips/[tripId]/members/[memberId]/remove/route.ts`:
```ts
import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/auth/session";
import { createServiceSupabaseClient } from "@/lib/supabase/service";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ tripId: string; memberId: string }> }
) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const { tripId, memberId } = await params;
  const supabase = createServiceSupabaseClient();
  const { data: trip } = await supabase.from("trips").select("admin_user_id").eq("id", tripId).single();
  if (!trip) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (trip.admin_user_id !== admin.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { error } = await supabase.from("members").update({ status: "removed" }).eq("id", memberId);
  if (error) return NextResponse.json({ error: "update_failed" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run "app/api/trips/[tripId]/members/[memberId]/remove/route.test.ts"`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add admin member-removal route"
```

---

### Task 13: Shared UI primitives (tokens → components)

**Files:**
- Create: `components/caravan/avatar.tsx`
- Create: `components/caravan/chip.tsx`
- Create: `components/caravan/card.tsx`
- Create: `components/caravan/progress-dots.tsx`
- Create: `components/caravan/app-bar.tsx`
- Create: `components/caravan/tab-bar.tsx`

**Interfaces:**
- Produces: `<Avatar name size color />`, `<AvatarStack members={{name,color}[]} />`, `<Chip selected>`, `<Card variant="default"|"flat"|"line">`, `<ProgressDots step total>`, `<AppBar title back right />`, `<TabBar active="Room"|"Plan"|"You" badges={{Room?,Plan?,You?}} />`.
- Consumed by: Tasks 14–16 (every screen).

Reference: `docs/design/screens.html` lines 96–143 (`.av`, `.chip`, `.card`, `.dots`, `.appbar`, `.tabbar` CSS rules) for exact sizing/spacing translated to Tailwind.

- [ ] **Step 1: Avatar + AvatarStack**

`components/caravan/avatar.tsx`:
```tsx
const MEMBER_COLORS = ["m1", "m2", "m3", "m4", "m5", "m6"] as const;

export function memberColorClass(index: number) {
  return `bg-${MEMBER_COLORS[index % MEMBER_COLORS.length]}`;
}

export function initials(name: string) {
  return name.trim().slice(0, 2).toUpperCase();
}

export function Avatar({
  name,
  colorIndex = 0,
  size = "md",
}: {
  name: string;
  colorIndex?: number;
  size?: "xs" | "sm" | "md" | "lg";
}) {
  const sizeClass = { xs: "size-5 text-[9px]", sm: "size-6 text-[9.5px]", md: "size-8 text-xs", lg: "size-11 text-base" }[size];
  return (
    <div
      className={`${sizeClass} ${memberColorClass(colorIndex)} shrink-0 rounded-full grid place-items-center font-semibold text-white`}
    >
      {initials(name)}
    </div>
  );
}

export function AvatarStack({ members }: { members: { name: string; colorIndex: number }[] }) {
  return (
    <div className="flex">
      {members.map((m, i) => (
        <div key={m.name + i} className={i > 0 ? "-ml-2" : ""}>
          <div className="ring-2 ring-paper rounded-full">
            <Avatar name={m.name} colorIndex={m.colorIndex} size="sm" />
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Chip**

`components/caravan/chip.tsx`:
```tsx
export function Chip({
  children,
  selected = false,
  onClick,
}: {
  children: React.ReactNode;
  selected?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3.5 py-2 rounded-full text-sm border whitespace-nowrap ${
        selected ? "bg-ink border-ink text-paper font-medium" : "bg-card border-line text-ink-2"
      }`}
    >
      {children}
    </button>
  );
}
```

- [ ] **Step 3: Card**

`components/caravan/card.tsx`:
```tsx
export function Card({
  children,
  variant = "default",
  className = "",
}: {
  children: React.ReactNode;
  variant?: "default" | "flat" | "line";
  className?: string;
}) {
  const variantClass = {
    default: "bg-card",
    flat: "bg-sunk",
    line: "bg-transparent border border-line",
  }[variant];
  return <div className={`rounded-lg p-4 ${variantClass} ${className}`}>{children}</div>;
}
```

- [ ] **Step 4: ProgressDots**

`components/caravan/progress-dots.tsx`:
```tsx
export function ProgressDots({ step, total }: { step: number; total: number }) {
  return (
    <div className="flex gap-1.5 items-center">
      {Array.from({ length: total }, (_, i) => (
        <i
          key={i}
          className={`h-1.5 rounded-full ${i === step ? "w-5.5 bg-plum" : "w-1.5 bg-line"}`}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 5: AppBar**

`components/caravan/app-bar.tsx`:
```tsx
"use client";
import { useRouter } from "next/navigation";

export function AppBar({
  title,
  back = true,
  right,
}: {
  title: string;
  back?: boolean;
  right?: React.ReactNode;
}) {
  const router = useRouter();
  return (
    <div className="flex items-center gap-3 px-5 pt-1 pb-3">
      {back && (
        <button onClick={() => router.back()} className="text-xl -mt-0.5" aria-label="Back">
          &lsaquo;
        </button>
      )}
      <h3 className="font-display text-lg font-semibold tracking-tight">{title}</h3>
      {right && <span className="ml-auto text-xs text-ink-2">{right}</span>}
    </div>
  );
}
```

- [ ] **Step 6: TabBar**

`components/caravan/tab-bar.tsx`:
```tsx
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { name: "Room", href: (tripId: string) => `/trip/${tripId}/room` },
  { name: "Plan", href: (tripId: string) => `/trip/${tripId}/plan` },
  { name: "You", href: (tripId: string) => `/trip/${tripId}/you` },
] as const;

export function TabBar({ tripId, badges = {} }: { tripId: string; badges?: Partial<Record<string, number>> }) {
  const pathname = usePathname();
  return (
    <div className="flex border-t border-line bg-card pt-2 px-2 pb-6">
      {TABS.map((tab) => {
        const href = tab.href(tripId);
        const active = pathname === href;
        return (
          <Link
            key={tab.name}
            href={href}
            className={`flex-1 flex flex-col items-center gap-1 text-[11px] relative ${
              active ? "text-plum font-semibold" : "text-ink-3"
            }`}
          >
            <span className={`size-5 rounded-md ${active ? "bg-plum" : "bg-ink-3/50"}`} />
            {tab.name}
            {badges[tab.name] ? (
              <span className="absolute -top-1 right-1/2 mr-[-19px] bg-stop text-white text-[9px] font-semibold min-w-[15px] h-[15px] rounded-full grid place-items-center px-1">
                {badges[tab.name]}
              </span>
            ) : null}
          </Link>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 7: Verify build**

Run: `npm run build`
Expected: succeeds with no type errors.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: add shared UI primitives (avatar, chip, card, dots, app bar, tab bar)"
```

---

### Task 14: Admin flow — landing, sign-in, my trips, create wizard, invite, lobby

**Files:**
- Create: `app/page.tsx` (A1)
- Create: `app/sign-in/page.tsx` (A2)
- Create: `app/auth/callback/route.ts`
- Create: `app/trips/page.tsx` (A3)
- Create: `app/trips/new/basics/page.tsx` (A4)
- Create: `app/trips/new/vibe/page.tsx` (A5)
- Create: `app/trips/new/invite/page.tsx` (A6 — lives under the wizard path, not `[tripId]`, since the trip doesn't exist until this step creates it)
- Create: `app/trips/[tripId]/lobby/page.tsx` (A7)
- Create: `app/trips/new/new-trip-store.ts` (client-side draft state across the 3-step wizard)

**Interfaces:**
- Consumes: `Card`, `Chip`, `ProgressDots`, `AppBar`, `Avatar`/`AvatarStack` (Task 13); `createBrowserSupabaseClient` (Task 3); `POST /api/trips`, `PATCH /api/trips/[tripId]` (Tasks 8–9).

Reference: `docs/design/screens.html` lines 281–379 for exact copy/layout of A1–A7.

- [ ] **Step 1: A1 Landing**

`app/page.tsx`:
```tsx
import Link from "next/link";
import { Avatar } from "@/components/caravan/avatar";

export default function LandingPage() {
  return (
    <main className="min-h-screen flex flex-col justify-end gap-5 px-5 pb-10 pt-6 max-w-md mx-auto">
      <div className="flex-1" />
      <div className="flex items-center gap-2.5">
        <div className="size-11 rounded-2xl bg-plum grid place-items-center text-white font-semibold">C</div>
        <span className="font-display text-lg font-semibold">Caravan</span>
      </div>
      <h1 className="font-display text-3xl font-bold tracking-tight leading-tight">
        Somebody always ends up running the trip.
      </h1>
      <p className="text-ink-2 text-[15px] leading-relaxed">
        Share one link. Everyone drops their dates and budget from their own phone. An agent does
        the chasing, the date maths and the deciding.
      </p>
      <div className="flex-1" />
      <Link href="/sign-in" className="w-full py-4 rounded-xl bg-plum text-white text-center font-semibold">
        Start a trip
      </Link>
      <Link
        href="/join"
        className="w-full py-4 rounded-xl border border-line text-center font-semibold"
      >
        I have an invite code
      </Link>
    </main>
  );
}
```

- [ ] **Step 2: A2 Sign-in with Google OAuth**

`app/sign-in/page.tsx`:
```tsx
"use client";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { AppBar } from "@/components/caravan/app-bar";

export default function SignInPage() {
  const supabase = createBrowserSupabaseClient();

  async function signInWithGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback` },
    });
  }

  return (
    <main className="min-h-screen flex flex-col max-w-md mx-auto">
      <AppBar title="" />
      <div className="flex-1 flex flex-col justify-center gap-5 px-5">
        <h1 className="font-display text-2xl font-semibold">Sign in to start a trip</h1>
        <p className="text-ink-2 text-[15px]">
          Only you need an account. Everyone you invite joins with a name and an email, nothing
          else.
        </p>
      </div>
      <div className="flex flex-col gap-4 px-5 pb-10">
        <button
          onClick={signInWithGoogle}
          className="w-full py-4 rounded-xl border border-line font-semibold flex items-center justify-center gap-2"
        >
          Continue with Google
        </button>
        <p className="text-xs text-ink-3 text-center">
          Joining someone else&rsquo;s trip? Just open the link they sent you.
        </p>
      </div>
    </main>
  );
}
```

`app/auth/callback/route.ts` (standard Supabase/Next.js App Router OAuth code exchange):
```ts
import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  if (code) {
    const supabase = await createServerSupabaseClient();
    await supabase.auth.exchangeCodeForSession(code);
  }
  return NextResponse.redirect(`${origin}/trips`);
}
```

- [ ] **Step 3: A3 My trips**

`app/trips/page.tsx`:
```tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminUser } from "@/lib/auth/session";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { Card } from "@/components/caravan/card";

export default async function MyTripsPage() {
  const admin = await getAdminUser();
  if (!admin) redirect("/sign-in");

  const supabase = createServiceSupabaseClient();
  const { data: trips } = await supabase
    .from("trips")
    .select()
    .eq("admin_user_id", admin.id)
    .order("created_at", { ascending: false });

  return (
    <main className="min-h-screen flex flex-col max-w-md mx-auto px-5 pt-6 pb-10 gap-3">
      <h2 className="font-display text-2xl font-semibold mb-2">Your trips</h2>
      {(trips ?? []).map((trip) => (
        <Link key={trip.id} href={`/trips/${trip.id}/lobby`}>
          <Card>
            <div className="flex items-center">
              <span className="font-display text-base font-semibold">{trip.name}</span>
              <span className="ml-auto text-[10px] font-medium px-2 py-1 rounded-full bg-sunk text-ink-2">
                {trip.status === "lobby" ? "Draft" : trip.status === "active" ? "Moving" : "Closed"}
              </span>
            </div>
          </Card>
        </Link>
      ))}
      <div className="flex-1" />
      <Link href="/trips/new/basics" className="w-full py-4 rounded-xl bg-plum text-white text-center font-semibold">
        Start a trip
      </Link>
    </main>
  );
}
```

- [ ] **Step 4: New-trip draft store**

`app/trips/new/new-trip-store.ts` — a tiny sessionStorage-backed store so the 3-step wizard (A4→A5→A6) survives navigation without a backend draft table:
```ts
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
```

- [ ] **Step 5: A4 Create — basics**

`app/trips/new/basics/page.tsx`:
```tsx
"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AppBar } from "@/components/caravan/app-bar";
import { ProgressDots } from "@/components/caravan/progress-dots";
import { writeDraft, readDraft } from "@/app/trips/new/new-trip-store";

export default function NewTripBasicsPage() {
  const router = useRouter();
  const [name, setName] = useState(() => readDraft().name);
  const [roughIntent, setRoughIntent] = useState(() => readDraft().roughIntent);

  function next() {
    writeDraft({ name, roughIntent });
    router.push("/trips/new/vibe");
  }

  return (
    <main className="min-h-screen flex flex-col max-w-md mx-auto">
      <AppBar title="New trip" right="1 of 3" />
      <div className="flex-1 flex flex-col gap-4 px-5">
        <ProgressDots step={0} total={3} />
        <h1 className="font-display text-2xl font-semibold">What are we calling it?</h1>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-ink-2">Trip name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Goa, probably"
            className="bg-card border border-line rounded-md p-3.5"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-ink-2">The rough idea, if you have one</label>
          <input
            value={roughIntent}
            onChange={(e) => setRoughIntent(e.target.value)}
            placeholder="Long weekend, beaches, nothing over-planned"
            className="bg-card border border-line rounded-md p-3.5"
          />
        </div>
      </div>
      <div className="px-5 pb-10 pt-4">
        <button
          disabled={!name.trim()}
          onClick={next}
          className="w-full py-4 rounded-xl bg-plum text-white font-semibold disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </main>
  );
}
```

- [ ] **Step 6: A5 Create — vibe and tone**

`app/trips/new/vibe/page.tsx`:
```tsx
"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AppBar } from "@/components/caravan/app-bar";
import { ProgressDots } from "@/components/caravan/progress-dots";
import { Chip } from "@/components/caravan/chip";
import { writeDraft, readDraft } from "@/app/trips/new/new-trip-store";

const VIBE_OPTIONS = ["Beach", "Mountains", "Party", "Slow", "Road trip", "Food", "Trekking", "Cities"];
const BUDGET_OPTIONS = ["Under 10k", "10-20k", "20-35k", "Open"];
const TONES = [
  { value: "efficient" as const, label: "Efficient", desc: "Short. No jokes. Gets to the point." },
  { value: "warm" as const, label: "Warm", desc: "Friendly, a little chatty." },
  { value: "dry" as const, label: "Dry", desc: "Funny, slightly mouthy." },
];

export default function NewTripVibePage() {
  const router = useRouter();
  const draft = readDraft();
  const [vibe, setVibe] = useState<string[]>(draft.vibe);
  const [budgetHint, setBudgetHint] = useState(draft.budgetHint || BUDGET_OPTIONS[1]);
  const [agentTone, setAgentTone] = useState(draft.agentTone);

  function toggleVibe(v: string) {
    setVibe((cur) => (cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]));
  }

  function next() {
    writeDraft({ vibe, budgetHint, agentTone });
    router.push(`/trips/new/invite`);
  }

  return (
    <main className="min-h-screen flex flex-col max-w-md mx-auto">
      <AppBar title="New trip" right="2 of 3" />
      <div className="flex-1 flex flex-col gap-3 px-5">
        <ProgressDots step={1} total={3} />
        <h1 className="font-display text-2xl font-semibold">Set the starting vibe</h1>
        <p className="text-sm text-ink-2">
          A starting point, not a decision. The group can push back the moment the trip opens.
        </p>
        <div className="flex flex-wrap gap-1.5">
          {VIBE_OPTIONS.map((v) => (
            <Chip key={v} selected={vibe.includes(v)} onClick={() => toggleVibe(v)}>
              {v}
            </Chip>
          ))}
        </div>
        <label className="text-xs font-medium text-ink-2 mt-1.5">Rough budget a head</label>
        <div className="flex flex-wrap gap-1.5">
          {BUDGET_OPTIONS.map((b) => (
            <Chip key={b} selected={budgetHint === b} onClick={() => setBudgetHint(b)}>
              {b}
            </Chip>
          ))}
        </div>
        <label className="text-xs font-medium text-ink-2 mt-1.5">How should the agent talk?</label>
        <div className="flex flex-col gap-2">
          {TONES.map((t) => (
            <button
              key={t.value}
              onClick={() => setAgentTone(t.value)}
              className={`text-left p-3.5 rounded-lg flex items-center gap-3 ${
                agentTone === t.value ? "border-[1.5px] border-plum bg-plum-t" : "border border-line"
              }`}
            >
              <div className="flex-1">
                <div className="text-sm font-semibold">{t.label}</div>
                <div className="text-xs text-ink-3">{t.desc}</div>
              </div>
              <div
                className={`size-[18px] rounded-full border-[1.5px] ${
                  agentTone === t.value ? "bg-plum border-plum" : "border-line"
                }`}
              />
            </button>
          ))}
        </div>
      </div>
      <div className="px-5 pb-10 pt-4">
        <button onClick={next} className="w-full py-4 rounded-xl bg-plum text-white font-semibold">
          Next
        </button>
      </div>
    </main>
  );
}
```

- [ ] **Step 7: A6 Create — invite (also submits the trip to the API)**

`app/trips/new/invite/page.tsx`:
```tsx
"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AppBar } from "@/components/caravan/app-bar";
import { ProgressDots } from "@/components/caravan/progress-dots";
import { Card } from "@/components/caravan/card";
import { readDraft, clearDraft } from "@/app/trips/new/new-trip-store";
import type { TripRow } from "@/lib/database.types";

export default function NewTripInvitePage() {
  const router = useRouter();
  const [trip, setTrip] = useState<TripRow | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const draft = readDraft();
    fetch("/api/trips", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error("could not create trip");
        const { trip } = await res.json();
        setTrip(trip);
        clearDraft();
      })
      .catch(() => setError("Something went wrong creating the trip."));
  }, []);

  if (error) return <main className="p-5 text-stop">{error}</main>;
  if (!trip) return <main className="p-5 text-ink-2">Creating your trip&hellip;</main>;

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  const link = `${siteUrl}/join/${trip.invite_code}`;

  return (
    <main className="min-h-screen flex flex-col max-w-md mx-auto">
      <AppBar title="New trip" right="3 of 3" />
      <div className="flex-1 flex flex-col gap-4 px-5">
        <ProgressDots step={2} total={3} />
        <h1 className="font-display text-2xl font-semibold">Send them the code</h1>
        <p className="text-sm text-ink-2">No app, no signup. They open the link, type a name, and they are in.</p>
        <div className="bg-ink text-paper text-center rounded-lg py-6 px-4">
          <div className="font-mono text-[10.5px] text-signal">ROOM CODE</div>
          <div className="font-mono text-[38px] font-medium tracking-widest my-1.5">{trip.invite_code}</div>
          <div className="font-mono text-[11.5px] opacity-60">{link}</div>
        </div>
        <div className="flex gap-2.5">
          <button
            onClick={() => navigator.clipboard.writeText(link)}
            className="flex-1 py-3.5 rounded-xl border border-line font-semibold"
          >
            Copy link
          </button>
        </div>
        <Card variant="flat">
          <p className="text-sm">
            The room stays shut until you open it, so nobody trickles in over four days. Everyone
            starts at the same moment.
          </p>
        </Card>
      </div>
      <div className="px-5 pb-10 pt-4">
        <button
          onClick={() => router.push(`/trips/${trip.id}/lobby`)}
          className="w-full py-4 rounded-xl bg-plum text-white font-semibold"
        >
          Go to the lobby
        </button>
      </div>
    </main>
  );
}
```

- [ ] **Step 8: A7 Lobby (admin) with realtime join list**

`app/trips/[tripId]/lobby/page.tsx`:
```tsx
"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { AppBar } from "@/components/caravan/app-bar";
import { Avatar } from "@/components/caravan/avatar";
import type { MemberRow, TripRow } from "@/lib/database.types";

export default function AdminLobbyPage() {
  const { tripId } = useParams<{ tripId: string }>();
  const router = useRouter();
  const [trip, setTrip] = useState<TripRow | null>(null);
  const [members, setMembers] = useState<MemberRow[]>([]);

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();

    async function load() {
      const { data: tripData } = await supabase.from("trips").select().eq("id", tripId).single();
      setTrip(tripData);
      const { data: memberData } = await supabase
        .from("members")
        .select()
        .eq("trip_id", tripId)
        .eq("status", "active");
      setMembers(memberData ?? []);
    }
    load();

    const channel = supabase
      .channel(`lobby:${tripId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "members", filter: `trip_id=eq.${tripId}` },
        (payload) => setMembers((cur) => [...cur, payload.new as MemberRow])
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tripId]);

  async function startTrip() {
    const res = await fetch(`/api/trips/${tripId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "start" }),
    });
    if (res.ok) router.push(`/trip/${tripId}/room`);
  }

  async function toggleJoining() {
    const res = await fetch(`/api/trips/${tripId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "toggle_joining" }),
    });
    if (res.ok) {
      const { trip: updated } = await res.json();
      setTrip(updated);
    }
  }

  if (!trip) return <main className="p-5 text-ink-2">Loading&hellip;</main>;

  return (
    <main className="min-h-screen flex flex-col max-w-md mx-auto">
      <AppBar title={trip.name} back={false} right={trip.invite_code} />
      <div className="flex-1 flex flex-col gap-4 px-5">
        <div className="bg-card rounded-lg text-center p-5">
          <h1 className="font-display text-2xl font-semibold">{members.length} here, room still shut</h1>
          <p className="text-sm text-ink-2 mt-1.5">
            Open it when you think enough people have turned up.
          </p>
        </div>
        <div className="bg-card rounded-lg divide-y divide-line">
          {members.map((m, i) => (
            <div key={m.id} className="flex items-center gap-2.5 py-3 px-4">
              <Avatar name={m.display_name} colorIndex={i} />
              <div className="flex flex-col">
                <span className="text-sm font-medium">{m.display_name}</span>
                <span className="text-[11.5px] text-ink-3">{m.role === "admin" ? "you, admin" : "joined"}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="flex items-center">
          <span className="text-[10.5px] font-semibold px-2.5 py-1 rounded-full bg-sunk text-ink-2">
            {trip.joining_open ? "Joining open" : "Joining closed"}
          </span>
          <button onClick={toggleJoining} className="ml-auto text-sm text-ink-2 underline">
            {trip.joining_open ? "Shut it" : "Reopen it"}
          </button>
        </div>
      </div>
      <div className="px-5 pb-10 pt-4">
        <button onClick={startTrip} className="w-full py-4 rounded-xl bg-signal text-ink font-semibold">
          Open the room
        </button>
      </div>
    </main>
  );
}
```

- [ ] **Step 9: Verify build and manual walkthrough**

Run: `npm run build`
Expected: succeeds.

Manually (dev server, browser at 390px width): sign in with Google, confirm redirect to `/trips`, create a trip through all 3 wizard steps, confirm the invite screen shows a real 6-character code, confirm the lobby loads and shows the admin as a member.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: admin flow — landing, Google sign-in, create wizard, invite, lobby"
```

---

### Task 15: Member flow — invite landing, join, member lobby

**Files:**
- Create: `app/join/page.tsx` (fallback for "I have an invite code" — a single input that redirects to `/join/[code]`)
- Create: `app/join/[code]/page.tsx` (B1)
- Create: `app/join/[code]/form/page.tsx` (B2)
- Create: `app/trip/[tripId]/member-lobby/page.tsx` (B3)

**Interfaces:**
- Consumes: `Card`, `AvatarStack`, `AppBar` (Task 13); `GET`/`POST /api/join/[code]` (Task 10).

Reference: `docs/design/screens.html` lines 383–417 for exact copy/layout of B1–B3.

- [ ] **Step 1: `/join` fallback entry**

`app/join/page.tsx`:
```tsx
"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function JoinEntryPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  return (
    <main className="min-h-screen flex flex-col justify-center gap-4 px-5 max-w-md mx-auto">
      <h1 className="font-display text-2xl font-semibold">Enter your invite code</h1>
      <input
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase())}
        placeholder="ABCDEF"
        className="bg-card border border-line rounded-md p-3.5 font-mono tracking-widest text-center"
      />
      <button
        disabled={code.length < 6}
        onClick={() => router.push(`/join/${code}`)}
        className="w-full py-4 rounded-xl bg-plum text-white font-semibold disabled:opacity-40"
      >
        Continue
      </button>
    </main>
  );
}
```

- [ ] **Step 2: B1 Invite landing**

`app/join/[code]/page.tsx`:
```tsx
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { getMemberSession } from "@/lib/auth/session";

export default async function InviteLandingPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const supabase = createServiceSupabaseClient();
  const { data: trip } = await supabase
    .from("trips")
    .select("id, name, rough_intent, joining_open, status")
    .eq("invite_code", code)
    .single();

  if (!trip) notFound();

  // Duplicate join attempt with a still-valid cookie for THIS trip: resume silently
  // instead of showing the join form again (spec §8).
  const memberSession = await getMemberSession();
  if (memberSession && memberSession.tripId === trip.id) {
    redirect(trip.status === "active" ? `/trip/${trip.id}/room` : `/trip/${trip.id}/member-lobby`);
  }

  if (!trip.joining_open || trip.status === "closed") {
    return (
      <main className="min-h-screen flex flex-col justify-center px-5 max-w-md mx-auto text-center gap-3">
        <h1 className="font-display text-xl font-semibold">This trip isn&rsquo;t taking new members</h1>
        <p className="text-sm text-ink-2">Ask whoever invited you for a fresh link.</p>
      </main>
    );
  }

  const { count } = await supabase
    .from("members")
    .select("*", { count: "exact", head: true })
    .eq("trip_id", trip.id)
    .eq("status", "active");

  return (
    <main className="min-h-screen flex flex-col justify-end gap-4 px-5 pb-10 pt-8 max-w-md mx-auto">
      <div className="flex-1" />
      <span className="inline-block w-fit text-xs font-semibold px-2.5 py-1 rounded-full bg-plum-t text-plum">
        You&rsquo;re invited
      </span>
      <h1 className="font-display text-3xl font-bold tracking-tight">{trip.name}</h1>
      {trip.rough_intent && <p className="text-[15px] text-ink-2">{trip.rough_intent}</p>}
      <p className="text-sm text-ink-2">{count ?? 0} already in</p>
      <div className="flex-1" />
      <Link href={`/join/${code}/form`} className="w-full py-4 rounded-xl bg-plum text-white text-center font-semibold">
        Join the trip
      </Link>
      <p className="text-xs text-ink-3 text-center">No account needed. Takes about twenty seconds.</p>
    </main>
  );
}
```

- [ ] **Step 3: B2 Join form**

`app/join/[code]/form/page.tsx`:
```tsx
"use client";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { AppBar } from "@/components/caravan/app-bar";

export default function JoinFormPage() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    setSubmitting(true);
    setError(null);
    const res = await fetch(`/api/join/${code}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName, email }),
    });
    setSubmitting(false);
    if (!res.ok) {
      setError("Couldn't join right now — check your details and try again.");
      return;
    }
    const { member } = await res.json();
    router.push(`/trip/${member.trip_id}/member-lobby`);
  }

  return (
    <main className="min-h-screen flex flex-col max-w-md mx-auto">
      <AppBar title="Join" />
      <div className="flex-1 flex flex-col gap-4 px-5">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-ink-2">Your name</label>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Ishaan"
            className="bg-card border border-line rounded-md p-3.5"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-ink-2">Email</label>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="ishaan@..."
            type="email"
            className="bg-card border border-line rounded-md p-3.5"
          />
        </div>
        <p className="text-xs text-ink-3">
          Email is only for nudges and for getting back in from another phone. There is no
          password to forget.
        </p>
        {error && <p className="text-xs text-stop">{error}</p>}
      </div>
      <div className="px-5 pb-10 pt-4">
        <button
          disabled={!displayName.trim() || !email.trim() || submitting}
          onClick={submit}
          className="w-full py-4 rounded-xl bg-plum text-white font-semibold disabled:opacity-40"
        >
          Join
        </button>
      </div>
    </main>
  );
}
```

Note: the `POST /api/join/[code]` route from Task 10 returns `{ member }` where `member` is a raw `members` row — it already has `trip_id`, so `member.trip_id` above is correct.

- [ ] **Step 4: B3 Member lobby with realtime**

`app/trip/[tripId]/member-lobby/page.tsx`:
```tsx
"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { AvatarStack } from "@/components/caravan/avatar";
import type { MemberRow, TripRow } from "@/lib/database.types";

export default function MemberLobbyPage() {
  const { tripId } = useParams<{ tripId: string }>();
  const router = useRouter();
  const [trip, setTrip] = useState<TripRow | null>(null);
  const [members, setMembers] = useState<MemberRow[]>([]);

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();

    async function load() {
      const [{ data: tripData }, { data: memberData }] = await Promise.all([
        supabase.from("trips").select().eq("id", tripId).single(),
        supabase.from("members").select().eq("trip_id", tripId).eq("status", "active"),
      ]);
      setTrip(tripData);
      setMembers(memberData ?? []);
    }
    load();

    const channel = supabase
      .channel(`member-lobby:${tripId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "trips", filter: `id=eq.${tripId}` },
        (payload) => {
          const updated = payload.new as TripRow;
          setTrip(updated);
          if (updated.status === "active") router.push(`/trip/${tripId}/room`);
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "members", filter: `trip_id=eq.${tripId}` },
        (payload) => setMembers((cur) => [...cur, payload.new as MemberRow])
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tripId, router]);

  if (!trip) return <main className="p-5 text-ink-2">Loading&hellip;</main>;

  const you = members[members.length - 1];

  return (
    <main className="min-h-screen flex flex-col justify-center gap-4 px-5 text-center max-w-md mx-auto">
      <div className="flex justify-center mb-3.5">
        <AvatarStack members={members.map((m, i) => ({ name: m.display_name, colorIndex: i }))} />
      </div>
      <h1 className="font-display text-2xl font-semibold">You&rsquo;re in{you ? `, ${you.display_name}` : ""}</h1>
      <p className="text-[15px] text-ink-2">
        The admin hasn&rsquo;t opened the room yet. It&rsquo;ll unlock for everyone at once, and
        you&rsquo;ll get an email.
      </p>
    </main>
  );
}
```

- [ ] **Step 5: Verify build and manual walkthrough**

Run: `npm run build`
Expected: succeeds.

Manually: open the invite link from Task 14's Step 9 walkthrough in a second (incognito) browser, join with a name+email, confirm you land on the member lobby, confirm the admin's lobby screen updates the member count live without a refresh.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: member flow — invite landing, join form, realtime member lobby"
```

---

### Task 16: Trip shell (tab bar) + Room (D1/D2) + Plan/You stubs

**Files:**
- Create: `app/trip/[tripId]/layout.tsx`
- Create: `app/trip/[tripId]/room/page.tsx` (D1 kickoff state + D2 active state, same component)
- Create: `app/trip/[tripId]/room/room-feed.tsx` (client component: realtime subscription + composer)
- Create: `app/trip/[tripId]/plan/page.tsx` (stub empty state)
- Create: `app/trip/[tripId]/you/page.tsx` (stub empty state)

**Interfaces:**
- Consumes: `TabBar` (Task 13); `GET`/`POST /api/trips/[tripId]/messages` (Task 11); `createBrowserSupabaseClient` (Task 3).

Reference: `docs/design/screens.html` lines 527–554 for D1/D2 layout — **per Global Constraints, strip every `.agent` bubble, "FILED" receipt, and thread preview**; only the member-message bubbles (`.msg`) and composer carry over.

- [ ] **Step 1: Trip shell layout**

`app/trip/[tripId]/layout.tsx`:
```tsx
import { TabBar } from "@/components/caravan/tab-bar";

export default async function TripLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tripId: string }>;
}) {
  const { tripId } = await params;
  return (
    <div className="min-h-screen flex flex-col max-w-md mx-auto">
      <div className="flex-1 flex flex-col overflow-hidden">{children}</div>
      <TabBar tripId={tripId} />
    </div>
  );
}
```

- [ ] **Step 2: Room page (server component: initial state + kickoff banner)**

`app/trip/[tripId]/room/page.tsx`:
```tsx
import { notFound } from "next/navigation";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { RoomFeed } from "./room-feed";

export default async function RoomPage({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  const supabase = createServiceSupabaseClient();
  const { data: trip } = await supabase.from("trips").select().eq("id", tripId).single();
  if (!trip) notFound();

  const { data: messages } = await supabase
    .from("messages")
    .select()
    .eq("trip_id", tripId)
    .order("created_at", { ascending: true });

  return <RoomFeed tripId={tripId} tripName={trip.name} initialMessages={messages ?? []} />;
}
```

- [ ] **Step 3: Room feed (client component: realtime + composer)**

`app/trip/[tripId]/room/room-feed.tsx`:
```tsx
"use client";
import { useEffect, useRef, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import type { MessageRow } from "@/lib/database.types";

export function RoomFeed({
  tripId,
  tripName,
  initialMessages,
}: {
  tripId: string;
  tripName: string;
  initialMessages: MessageRow[];
}) {
  const [messages, setMessages] = useState<MessageRow[]>(initialMessages);
  const [draft, setDraft] = useState("");
  const feedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    const channel = supabase
      .channel(`room:${tripId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `trip_id=eq.${tripId}` },
        (payload) => setMessages((cur) => [...cur, payload.new as MessageRow])
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [tripId]);

  useEffect(() => {
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight });
  }, [messages.length]);

  async function send() {
    const body = draft.trim();
    if (!body) return;
    setDraft("");
    await fetch(`/api/trips/${tripId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    });
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex items-center gap-3 px-5 pt-1 pb-3">
        <h3 className="font-display text-lg font-semibold tracking-tight">{tripName}</h3>
      </div>
      <div ref={feedRef} className="flex-1 overflow-y-auto px-4 pb-3 flex flex-col gap-3.5">
        {messages.length === 0 && (
          <div className="bg-sunk rounded-lg p-4 text-sm text-ink-2">Trip started &mdash; say hello.</div>
        )}
        {messages.map((m) => (
          <div key={m.id} className="flex gap-2">
            <div className="bg-card rounded-[4px_15px_15px_15px] px-3.5 py-2.5 max-w-[262px]">
              <div className="text-sm">{m.body}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="border-t border-line bg-card px-3.5 py-2.5 pb-5 flex gap-2.5 items-center">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Say something"
          className="flex-1 bg-sunk rounded-full px-4 py-2.5 text-sm"
        />
        <button
          onClick={send}
          className="size-9 rounded-full bg-plum text-white grid place-items-center"
          aria-label="Send"
        >
          &uarr;
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Plan and You stubs**

`app/trip/[tripId]/plan/page.tsx`:
```tsx
export default function PlanPage() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-2 px-8 text-center">
      <h2 className="font-display text-lg font-semibold">Nothing to plan yet</h2>
      <p className="text-sm text-ink-2">
        Once the group starts talking, dates, budget, and destination will show up here.
      </p>
    </div>
  );
}
```

`app/trip/[tripId]/you/page.tsx`:
```tsx
export default function YouPage() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-2 px-8 text-center">
      <h2 className="font-display text-lg font-semibold">Nothing needs you yet</h2>
      <p className="text-sm text-ink-2">Your tasks and threads will show up here once the trip is moving.</p>
    </div>
  );
}
```

- [ ] **Step 5: Verify build and manual walkthrough**

Run: `npm run build`
Expected: succeeds.

Manually: from the admin lobby, tap "Open the room" — confirm the admin lands on the Room tab showing "Trip started — say hello." Post a message from the admin's browser and confirm it appears live in the member's browser (from Task 15's walkthrough) without a refresh, and vice versa. Confirm the Plan and You tabs show their stub empty states.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: trip shell with tab bar, realtime room feed, Plan/You stubs"
```

---

### Task 17: Integration test against the live Supabase project

**Files:**
- Create: `tests/integration/join-and-post.test.ts`
- Create: `vitest.integration.config.ts`

**Interfaces:**
- Consumes: `@supabase/supabase-js` directly (service role), the running dev server's API routes.
- Produces: an automated end-to-end check of create trip → two members join → start trip → post messages → both see all messages, run against the real `qnklzcugyjvtnadesbaf` project (test data only, cleaned up after).

- [ ] **Step 1: Integration test config**

`vitest.integration.config.ts`:
```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    testTimeout: 20000,
  },
});
```

Add to `package.json` scripts: `"test:integration": "vitest run -c vitest.integration.config.ts"`.

- [ ] **Step 2: Write the test**

This test talks directly to Postgres via the service-role client to set up an admin-owned trip (bypassing the Google OAuth UI, which can't be automated here), then drives the real HTTP API for join/post. Requires the dev server running at `http://localhost:3000` and `.env.local` populated.

`tests/integration/join-and-post.test.ts`:
```ts
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

const BASE_URL = process.env.TEST_BASE_URL ?? "http://localhost:3000";
let tripId: string;
let inviteCode: string;

beforeAll(async () => {
  // Create a fake admin auth user directly, since Google OAuth can't run headlessly here.
  const { data: user, error: userError } = await supabase.auth.admin.createUser({
    email: `test-admin-${Date.now()}@example.com`,
    email_confirm: true,
  });
  if (userError || !user.user) throw userError;

  const { data: trip, error: tripError } = await supabase
    .from("trips")
    .insert({
      name: "Integration Test Trip",
      admin_user_id: user.user.id,
      invite_code: `T${Date.now().toString(36).toUpperCase().slice(-5)}`,
    })
    .select()
    .single();
  if (tripError || !trip) throw tripError;
  tripId = trip.id;
  inviteCode = trip.invite_code;
});

afterAll(async () => {
  if (tripId) await supabase.from("trips").delete().eq("id", tripId);
});

describe("join and post flow", () => {
  it("lets two members join, the admin starts the trip, and both see all posted messages", async () => {
    const memberA = await fetch(`${BASE_URL}/api/join/${inviteCode}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName: "Member A", email: `a-${Date.now()}@example.com` }),
    });
    expect(memberA.status).toBe(200);
    const memberACookie = memberA.headers.get("set-cookie")!;
    const { member: memberAData } = await memberA.json();

    const memberB = await fetch(`${BASE_URL}/api/join/${inviteCode}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName: "Member B", email: `b-${Date.now()}@example.com` }),
    });
    const memberBCookie = memberB.headers.get("set-cookie")!;

    // Posting before start must be rejected.
    const tooEarly = await fetch(`${BASE_URL}/api/trips/${tripId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie: memberACookie },
      body: JSON.stringify({ body: "too early" }),
    });
    expect(tooEarly.status).toBe(409);

    await supabase.from("trips").update({ status: "active" }).eq("id", tripId);

    const postA = await fetch(`${BASE_URL}/api/trips/${tripId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie: memberACookie },
      body: JSON.stringify({ body: "hello from A" }),
    });
    expect(postA.status).toBe(201);

    const listForB = await fetch(`${BASE_URL}/api/trips/${tripId}/messages`, {
      headers: { cookie: memberBCookie },
    });
    const { messages } = await listForB.json();
    expect(messages.some((m: { body: string }) => m.body === "hello from A")).toBe(true);
    expect(memberAData.trip_id).toBe(tripId);
  });
});
```

- [ ] **Step 3: Run it**

Run: `npm run dev` in one terminal, then in another: `npm run test:integration`
Expected: PASS (1 test). If it fails on the `auth.admin.createUser` call, confirm `SUPABASE_SERVICE_ROLE_KEY` in `.env.local` is the actual service role key (from the Supabase dashboard → Project Settings → API), not the anon key.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "test: add end-to-end integration test for join/start/post flow"
```

---

### Task 18: Deploy to Vercel and wire environment variables

**Files:** none (infra/config task)

**Interfaces:**
- Consumes: the Vercel MCP tools (`create_git_project`), the four secrets the user must supply (`NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `JWT_SECRET`, and Google OAuth client id/secret configured directly in the Supabase dashboard, not in Vercel).

- [ ] **Step 1: Push all committed work**

```bash
git push origin main
```

- [ ] **Step 2: Create the linked Vercel project**

Use the Vercel MCP `create_git_project` tool with `repo: "amit429/caravan"`, `teamId` from `list_teams`, `deploy: true`.

- [ ] **Step 3: Set environment variables in Vercel**

For each of `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `JWT_SECRET`, `NEXT_PUBLIC_SITE_URL` (set to the assigned `*.vercel.app` production URL once known): run `vercel env add <NAME> production` and paste the value when prompted (values come from: Supabase dashboard for the Supabase ones, a freshly generated 32+ byte random string via `openssl rand -base64 32` for `JWT_SECRET`).

- [ ] **Step 4: Configure the Supabase Auth redirect URL**

In the Supabase dashboard → Authentication → URL Configuration, add `https://<production-domain>/auth/callback` to the redirect allow-list (localhost's should already be there from local dev).

- [ ] **Step 5: Trigger a production deploy and verify**

Redeploy (push a commit or use the Vercel MCP) and confirm the production URL loads A1, and that signing in with Google completes end-to-end in production.

- [ ] **Step 6: Run Supabase advisors one more time**

Use the Supabase MCP `get_advisors` tool with `type: "security"` against project `qnklzcugyjvtnadesbaf`. Confirm the result is still empty (or address any new findings before calling Phase 1 done).

---

## Post-plan note

This plan does not include Google OAuth client creation in Google Cloud Console — that's a manual dashboard task for the user, needed before Task 14's sign-in flow can be tested end-to-end. The Task 18 execution step should prompt for those credentials if they haven't been supplied yet, and confirm the exact redirect URI to register in Google Cloud (`https://qnklzcugyjvtnadesbaf.supabase.co/auth/v1/callback` — the **Supabase** callback, not the app's `/auth/callback`, since Supabase Auth is the OAuth client).
