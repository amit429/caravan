# Caravan — Phase 1 (Skeleton) Design Spec

**Date:** 2026-09-12
**Status:** Approved
**Scope:** PRD §16 Phase 1 ("Skeleton"), covering F1 and F2 in full, and a no-AI subset of F3.
**Explicitly deferred:** Trip Brain content (F10), facts/decisions/voting (F5–F7), any LLM/agent
call, Inngest, Resend, PostHog, Tavily/Brave. Those are Phase 2+ and get their own spec.

This is the first of five phases from the PRD's Build Order (§16). Each phase gets its own
design → plan → build cycle; this document covers Phase 1 only.

---

## 1. Goal and demo criteria

Demo: an admin creates a trip from a Google-signed-in session, shares a link, five people join
from that link with just a name and email, the admin starts the trip, and everyone sees the same
async message board update in near-real-time as people post. No AI anywhere in this phase.

## 2. Out of scope (explicit non-goals for this phase)

- Trip Brain panel content — the "Plan" tab exists as a shell/empty state only.
- Any fact extraction, date solving, decisions, or voting.
- Any agent (Concierge/Scribe/Chaser/Scout/Planner/Quartermaster) — zero LLM calls.
- Inngest, cron, nudges, email digests.
- Threads (D8) — deferred to Phase 2, since threads carry the private-lane/intake mechanic that
  doesn't exist yet.

## 3. Identity & auth model (PRD §10)

Two tiers, deliberately not unified:

- **Admin** — Supabase Auth, Google OAuth provider only. `trips.admin_user_id` references
  `auth.users.id`.
- **Member** — no Supabase Auth account. On join, the server verifies the invite code, creates a
  `members` row, and issues a signed JWT (HS256, `JWT_SECRET` env var) containing
  `{trip_id, member_id}`, stored as an httpOnly, secure, `SameSite=Lax` cookie. This is the
  session for all member-scoped API routes in this phase. No magic-link/email re-entry yet
  (that's F2's "rejoin from email on a new device" — deferred to Phase 2 since it needs Resend).
- Duplicate email rejoining the same trip resumes the same `members` row rather than creating a
  new one (F2 requirement) — enforced by a unique constraint on `(trip_id, email)`.

## 4. Data model (subset of PRD §11)

Only the tables Phase 1 needs. Later phases add `facts`, `availability`, `decisions`, `votes`,
`trip_brain`, `agent_runs`, `tasks` without altering these.

```sql
trips (
  id uuid pk default gen_random_uuid(),
  name text not null,
  rough_intent text,
  admin_user_id uuid not null references auth.users(id),
  invite_code text not null unique,      -- 6 char, uppercase alnum, no ambiguous chars
  status text not null default 'lobby',  -- lobby | active | closed
  joining_open boolean not null default true,
  created_at timestamptz not null default now()
)

members (
  id uuid pk default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  display_name text not null,
  email text not null,
  role text not null default 'member',   -- member | admin (admin row mirrors the auth admin so
                                          -- the member list can render them uniformly)
  status text not null default 'active', -- active | removed
  device_token_hash text,                -- for future device-persisted identity checks
  joined_at timestamptz not null default now(),
  unique (trip_id, email)
)

messages (
  id uuid pk default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  lane text not null default 'group',    -- only 'group' exists in Phase 1
  author_type text not null,             -- 'member' only in Phase 1
  author_id uuid references members(id),
  body text not null,
  created_at timestamptz not null default now()
)
```

**RLS:** admins can read/write rows where `trips.admin_user_id = auth.uid()`. Members have no
Supabase Auth session, so member-scoped reads/writes go through server-side API routes using the
Postgres **service role** key after verifying the member JWT — RLS on `members`/`messages` denies
the anon key entirely for those tables. This matches PRD §7.4's deterministic-core principle:
trust boundaries are enforced in plain server code, not inferred.

## 5. Trip lifecycle (D5)

`lobby` → (admin taps "Start the trip") → `active` → (admin closes, future phase) → `closed`.
No one can post a `messages` row while `status = 'lobby'`, enforced server-side, not just in the
UI. Admin can toggle `joining_open` independent of `status` (F1: "close joining, reopen").

## 6. Realtime

Supabase Realtime (Postgres changes) on `messages` filtered by `trip_id`, subscribed from the
Room screen. This is D1's "async structured board," not a live-typing chat — no typing-presence
channel, no read receipts. New rows simply append as cards.

## 7. Screens in scope (from caravan-ui-spec.md §5, tokens from caravan-screens.html)

| Flow | Screens | Notes |
|---|---|---|
| A — Admin setup | A1 Landing, A2 Google sign-in, A3 My trips, A4 Create basics, A6 Create invite, A7 Lobby (admin) | A5 (vibe & tone) is stubbed as a static no-op step — tone/vibe fields are stored but unused until agents exist |
| B — Member join | B1 Invite landing, B2 Join form, B3 Lobby (member) | |
| D — Room | D1 Room kickoff (static "trip started" system card, no agent voice yet), D2 Room active (member messages only) | |
| Shell | Bottom tab bar (Room / Plan / You) | Plan and You are empty-state placeholders this phase |

Visual source of truth: `caravan-screens.html` tokens (plum `#5D2A5B` / signal `#CBE83A` palette,
Bricolage Grotesque + Inter Tight + DM Mono). `caravan-ui-spec.md` supplies the IA, component
inventory, and screen list. Where the two conflict on anything besides color/type tokens, the
screens.html markup wins since it's the more concrete artifact.

## 8. Error handling

- Invalid/expired invite code → B1 shows "this trip isn't taking new members" empty state, not a
  generic error.
- Duplicate join attempt (same email, has a valid cookie already) → silently resume session,
  redirect straight to B3/D2 instead of re-running the join form.
- Posting while `status = 'lobby'` → blocked server-side with 409; client shouldn't be able to
  reach this state since the composer is hidden pre-start, but the API is the actual boundary.
- Admin removing a member → member's next request with their JWT gets 403 and the client clears
  the cookie and shows a "removed from this trip" state.

## 9. Testing approach

- Unit tests (Vitest) for: invite code generation/uniqueness retry, JWT sign/verify, the
  lobby→active state machine, RLS-adjacent server route auth checks.
- Integration test for the join flow against a local Supabase instance (`supabase start`):
  create trip → join as two members → post messages → verify Realtime delivery.
- No component/visual testing framework introduced this phase; screens are checked manually
  against `caravan-screens.html` at 390×844.

## 10. Environment variables introduced this phase

`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
`JWT_SECRET`, `GOOGLE_OAUTH_CLIENT_ID`/`SECRET` (configured in Supabase Auth dashboard, not read
directly by the app). All except the two `NEXT_PUBLIC_*` values are server-only.

## 11. Repo & deploy

New public GitHub repo `amit429/caravan`. Next.js 15 (App Router) + TypeScript + Tailwind v4 +
shadcn/ui, deployed to Vercel linked to the repo's default branch. Existing `caravan-prd-v0.1.md`,
`caravan-ui-spec.md`, `caravan-screens.html` move into `docs/` in the new repo as the design
record of truth for later phases.
