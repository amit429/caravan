# 🧭 Caravan

**The agentic group trip planner.** Caravan replaces the unpaid "trip mom" inside every group chat — the one person who DMs everyone for dates, aggregates them by hand, proposes destinations, absorbs 200 forwarded reels, and sends the reminders — with a team of purpose-built AI agents living inside a shared trip room.

> One admin creates a trip and shares a code. Everyone else joins with Google, in about twenty seconds. The agents extract constraints from what people say, run the date math, force decisions to close, propose destinations with real reasoning, build the itinerary, and chase the stragglers — so the group chat converges on a plan instead of dying in a pile of "so are we doing this or not?"
>

Live Deployment: https://caravan.amitpile.com/

[![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=next.js&logoColor=white)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Supabase](https://img.shields.io/badge/Supabase-Postgres%20%7C%20Auth%20%7C%20Realtime-3FCF8E?logo=supabase&logoColor=white)](https://supabase.com)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![Vercel AI SDK](https://img.shields.io/badge/Vercel%20AI%20SDK-v7-000000?logo=vercel&logoColor=white)](https://sdk.vercel.ai)
[![Vitest](https://img.shields.io/badge/tests-383%20passing-2ecc71?logo=vitest&logoColor=white)](#testing)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## Table of contents

- [Why Caravan exists](#why-caravan-exists)
- [Screenshots](#screenshots)
- [Feature tour](#feature-tour)
- [Tech stack](#tech-stack)
- [Architecture](#architecture)
- [The agents](#the-agents)
- [Database schema](#database-schema)
- [Getting started](#getting-started)
- [Docker](#docker)
- [Project structure](#project-structure)
- [Testing](#testing)
- [Deployment](#deployment)
- [Design principles](#design-principles)
- [Known limitations / roadmap](#known-limitations--roadmap)
- [License](#license)

---

## Why Caravan exists

Group trips don't fail because chats don't capture information — they capture plenty. They fail because a group chat has **no mechanism to close a question**. "Anyone free the 2nd week of Dec?" gets four replies, two jokes, and then dies. Three weeks later someone asks "so are we doing this or not?" and the cycle restarts. Meanwhile prices go up and the window closes.

Caravan's product thesis rests on three bets:

1. **Convergence, not note-taking.** An agent that summarizes the chat is a toy. An agent that says *"3 of 5 want Goa, Rhea's budget caps things at ₹15k so Nov 12–15 beats Dec 20–24, voting closes Friday 6pm, silence counts as a yes"* is the organiser. Deadlines, quorum, and defaults-on-silence are the core mechanic — not the LLM.
2. **Private inputs, public consensus.** People don't say "I can't afford ₹20k" in a group of eight. Every member gets a private 1:1 lane with the agent — budgets and hard constraints go in privately; only the aggregate ("the plan needs to land under ₹16k/head") ever surfaces publicly.
3. **The state is the product, chat is just the input.** Dates, budget ceilings, the locked destination, the itinerary — these are real rows in a database with a lifecycle, not something buried thirty messages back.
4. **The system nudges before an admin has to.** A decision locks the instant everyone's voted — no deadline required, no admin tap. The moment it locks, the next thing (itinerary, cost, checklist) generates on its own. If a vote stalls on 1-2 people, they get a private, specific nudge instead of the admin having to notice and DM them. If the group's been talking for a while, an agent recaps it and surfaces what's clearly emerging as an idea.

---

## Screenshots

Every screen below is a render of [`docs/design/screens.html`](docs/design/screens.html) — the hi-fi design spec this app was built from, organized into the same seven flows (A–G) the spec itself uses. **These are the design reference, not live-app screenshots** — a few details have since diverged as the build evolved (invite codes are plain 6-character codes now, not hyphenated; joining is Google OAuth for everyone, not a name/email form; Your Trips gained avatar stacks and richer status styling; and several screens below — the destination page, the per-member facts page, settings' danger zone — were redesigned past what's pictured here). Cross-reference against [Feature tour](#feature-tour) for what's actually implemented today.

### A · Setting up a trip

<table><tr>
<td align="center" width="150"><img src="docs/screens/A-setup/A1-landing.png" width="130"><br><sub><b>A1</b><br>Landing</sub></td>
<td align="center" width="150"><img src="docs/screens/A-setup/A2-admin-sign-in.png" width="130"><br><sub><b>A2</b><br>Admin sign-in</sub></td>
<td align="center" width="150"><img src="docs/screens/A-setup/A3-your-trips.png" width="130"><br><sub><b>A3</b><br>Your trips</sub></td>
<td align="center" width="150"><img src="docs/screens/A-setup/A4-new-trip-basics.png" width="130"><br><sub><b>A4</b><br>New trip — basics</sub></td>
</tr><tr>
<td align="center" width="150"><img src="docs/screens/A-setup/A5-new-trip-vibe-and-tone.png" width="130"><br><sub><b>A5</b><br>New trip — vibe & tone</sub></td>
<td align="center" width="150"><img src="docs/screens/A-setup/A6-new-trip-invite.png" width="130"><br><sub><b>A6</b><br>New trip — invite</sub></td>
<td align="center" width="150"><img src="docs/screens/A-setup/A7-lobby-admin.png" width="130"><br><sub><b>A7</b><br>Lobby — admin</sub></td>
</tr></table>

### B · Joining

<table><tr>
<td align="center" width="150"><img src="docs/screens/B-join/B1-invite-landing.png" width="130"><br><sub><b>B1</b><br>Invite landing</sub></td>
<td align="center" width="150"><img src="docs/screens/B-join/B2-join.png" width="130"><br><sub><b>B2</b><br>Join</sub></td>
<td align="center" width="150"><img src="docs/screens/B-join/B3-lobby-member.png" width="130"><br><sub><b>B3</b><br>Lobby — member</sub></td>
</tr></table>

### C · Intake, in a thread with the agent

<table><tr>
<td align="center" width="150"><img src="docs/screens/C-intake/C1-intake-intro.png" width="130"><br><sub><b>C1</b><br>Intake — intro</sub></td>
<td align="center" width="150"><img src="docs/screens/C-intake/C2-intake-when-youre-free.png" width="130"><br><sub><b>C2</b><br>Intake — when you're free</sub></td>
<td align="center" width="150"><img src="docs/screens/C-intake/C3-intake-budget.png" width="130"><br><sub><b>C3</b><br>Intake — budget</sub></td>
<td align="center" width="150"><img src="docs/screens/C-intake/C4-intake-where-from.png" width="130"><br><sub><b>C4</b><br>Intake — where from</sub></td>
</tr><tr>
<td align="center" width="150"><img src="docs/screens/C-intake/C5-intake-vibe.png" width="130"><br><sub><b>C5</b><br>Intake — vibe</sub></td>
<td align="center" width="150"><img src="docs/screens/C-intake/C6-intake-hard-nos.png" width="130"><br><sub><b>C6</b><br>Intake — hard nos</sub></td>
<td align="center" width="150"><img src="docs/screens/C-intake/C7-intake-done.png" width="130"><br><sub><b>C7</b><br>Intake — done</sub></td>
</tr></table>

### D · The room

<table><tr>
<td align="center" width="150"><img src="docs/screens/D-room/D1-room-the-kickoff.png" width="130"><br><sub><b>D1</b><br>Room — the kickoff</sub></td>
<td align="center" width="150"><img src="docs/screens/D-room/D2-room-in-motion.png" width="130"><br><sub><b>D2</b><br>Room — in motion</sub></td>
<td align="center" width="150"><img src="docs/screens/D-room/D3-composer-open.png" width="130"><br><sub><b>D3</b><br>Composer, open</sub></td>
<td align="center" width="150"><img src="docs/screens/D-room/D4-a-thread.png" width="130"><br><sub><b>D4</b><br>A thread</sub></td>
</tr><tr>
<td align="center" width="150"><img src="docs/screens/D-room/D5-agent-voice-all-five-modes.png" width="130"><br><sub><b>D5</b><br>Agent voice, all five modes</sub></td>
</tr></table>

### E · The plan

<table><tr>
<td align="center" width="150"><img src="docs/screens/E-plan/E1-plan-overview.png" width="130"><br><sub><b>E1</b><br>Plan — overview</sub></td>
<td align="center" width="150"><img src="docs/screens/E-plan/E2-a-single-fact.png" width="130"><br><sub><b>E2</b><br>A single fact</sub></td>
<td align="center" width="150"><img src="docs/screens/E-plan/E3-whos-in.png" width="130"><br><sub><b>E3</b><br>Who's in</sub></td>
<td align="center" width="150"><img src="docs/screens/E-plan/E4-paste-into-whatsapp.png" width="130"><br><sub><b>E4</b><br>Paste into WhatsApp</sub></td>
</tr></table>

### F · Decisions

<table><tr>
<td align="center" width="150"><img src="docs/screens/F-decisions/F1-which-dates-actually-work.png" width="130"><br><sub><b>F1</b><br>Which dates actually work</sub></td>
<td align="center" width="150"><img src="docs/screens/F-decisions/F2-a-decision-in-the-feed.png" width="130"><br><sub><b>F2</b><br>A decision, in the feed</sub></td>
<td align="center" width="150"><img src="docs/screens/F-decisions/F3-decision-opened-up.png" width="130"><br><sub><b>F3</b><br>Decision, opened up</sub></td>
<td align="center" width="150"><img src="docs/screens/F-decisions/F4-three-places-with-the-reasoning.png" width="130"><br><sub><b>F4</b><br>Three places, with the reasoning</sub></td>
</tr><tr>
<td align="center" width="150"><img src="docs/screens/F-decisions/F5-one-option-in-full.png" width="130"><br><sub><b>F5</b><br>One option, in full</sub></td>
<td align="center" width="150"><img src="docs/screens/F-decisions/F6-locked.png" width="130"><br><sub><b>F6</b><br>Locked</sub></td>
<td align="center" width="150"><img src="docs/screens/F-decisions/F7-when-a-veto-blocks-the-winner.png" width="130"><br><sub><b>F7</b><br>When a veto blocks the winner</sub></td>
</tr></table>

### G · After the decision

<table><tr>
<td align="center" width="150"><img src="docs/screens/G-after/G1-itinerary.png" width="130"><br><sub><b>G1</b><br>Itinerary</sub></td>
<td align="center" width="150"><img src="docs/screens/G-after/G2-ideas-people-dropped.png" width="130"><br><sub><b>G2</b><br>Ideas people dropped</sub></td>
<td align="center" width="150"><img src="docs/screens/G-after/G3-what-you-still-have-to-do.png" width="130"><br><sub><b>G3</b><br>What you still have to do</sub></td>
<td align="center" width="150"><img src="docs/screens/G-after/G4-whos-booked-what.png" width="130"><br><sub><b>G4</b><br>Who's booked what</sub></td>
</tr><tr>
<td align="center" width="150"><img src="docs/screens/G-after/G5-what-its-going-to-cost.png" width="130"><br><sub><b>G5</b><br>What it's going to cost</sub></td>
<td align="center" width="150"><img src="docs/screens/G-after/G6-admin-controls.png" width="130"><br><sub><b>G6</b><br>Admin controls</sub></td>
<td align="center" width="150"><img src="docs/screens/G-after/G7-nudges-and-the-weekly-email.png" width="130"><br><sub><b>G7</b><br>Nudges and the weekly email</sub></td>
</tr></table>

## Feature tour

### Onboarding & identity
- Google OAuth for **everyone** — admin and members alike — via Supabase Auth. No name/email form, no separate guest-JWT system.
- Invite by code *or* link (`/join/[code]`); if you're already signed in, clicking the link drops you straight into the lobby.
- Joining can be shut off mid-lobby without kicking anyone already in.

### The room
- Shared group chat with a visually distinct agent lane (kickoff messages, decision lifecycle announcements, Scribe's "filed: ..." receipts).
- **Threads** — a private 1:1 lane per member with the agent (intake happens here; "ask the agent" questions land here too).
- Composer actions: paste a link → files it as an Idea; put something to a vote; ask the agent a plain-language question about costs/dates/who's said what.
- Realtime everywhere via a custom Supabase broadcast channel (not just `postgres_changes`, which under RLS only ever reaches the trip's admin — see [Architecture](#architecture)), with a polling safety net so nobody's screen can get permanently stuck.

### The five questions (private intake)
- Tri-state drag-to-select availability calendar (free / tight / can't).
- Budget slider, ₹5k–₹2L, with one-tap presets — **never shown to anyone, including the admin**. Only the aggregated group ceiling (the tightest submitted number) ever surfaces.
- Departure city, vibe tags, hard nos (with one-tap common suggestions).
- The agent "confirms what it heard" back in your thread instead of a silent form-save.
- A private **scrapbook** (You tab) aggregates everything a member has told the trip — their own facts, *including budget* (hiding it is about other people not seeing your number, not about hiding it from yourself) — plus every idea they've filed, in one place.

### Continuous extraction from chat
- **Scribe** gates every group/thread message ("does this contain a constraint, date, budget, or preference?") before spending a full extraction call on it.
- Extracted facts/availability are attributed only to their own author, filed at a confidence floor, and a receipt is posted back.
- A later chat correction — either direction ("actually I can't make the 5th" or "turns out I can now") — properly overrides an earlier answer: availability resolves per-day by *recency*, and budget/departure-city facts get superseded by the newer statement instead of sitting alongside a stale one.
- Extraction is anchored to the trip's own established year and leading date-window context, so a rephrased request ("can we do it before March 1st instead?") resolves against the trip's real timeline instead of guessing.
- A free-text place/activity mention ("let's do scuba diving and snorkeling") gets filed as an **Idea** automatically, the same as a pasted link. A hotel mention or link routes straight to [Accommodations](#accommodations--travel-options), a flight/bus/train/ferry mention to [Travel options](#accommodations--travel-options) — each gets AI-enriched (price, area, or mode) on the spot, not just a generic card.
- If extraction fails, Scribe retries once with its own invalid output and the exact validation error echoed back for self-correction — but a live-reproduced failure mode (the model flaking on the same field's exact shape in several different, non-overlapping ways run to run: a stringified value, a renamed field, snake_case keys, a dropped author id) survived that retry unprompted. Fixed at the boundary instead: the raw JSON is normalized (key casing, known field aliases, missing-author defaulting) before Zod ever validates it, so generation doesn't have to be perfect for extraction to succeed. If it still can't parse the message, Scribe posts an honest "couldn't pin down the specifics — mind rephrasing?" reply instead of staying silent.

### Decisions
- Five types: **DATES, DESTINATION, BUDGET, STAY, ACTIVITY, CUSTOM**. Vote, veto ("hard no" — can never be voted away), lock.
- Deterministic date solver, prioritized by the trip's **preferred duration** (2/3/5/7/10/14-day presets, set at trip creation and changeable later in Settings — existing trips default to 7): option 1 is always the best window at the *full* preferred length; options 2 and 3 explore every shorter length, trading duration for attendance, so a majority-fits-but-not-everyone stretch and a shorter everyone-fits compromise both show up as real, distinct choices — not just whatever slice happens to score highest.
- **Auto-refreshes** an already-OPEN DATES vote the moment it goes stale — a new availability row from chat, an intake edit, or a changed duration preference — by dropping and cleanly recomputing it, with a message explaining why. Previously the options were a one-time snapshot from whenever the vote opened; a correction in chat ("actually I can do the 27th to the 5th") had no way to reach it.
- Locking with a hard-no conflict shows the admin the runner-up and requires an explicit, logged override to force it anyway.
- **Auto-locks the instant every active member has voted** — independent of any deadline, no admin tap required. Deadlines still work the way they always did (auto-lock + 24h reminder on expiry) as a separate, optional path. Both fire from the same scheduled sweep (Chaser) — pure rule-based, no LLM.
- Admin can delete any decision (locked or not); the agent announces the deletion in the room and invites the group to discuss and regenerate.

### Autonomous coordination — zero admin taps
The core thing this layer removes: an admin having to notice a vote closed, or a decision stalled, and manually tap a button.
- The moment a decision locks (by quorum *or* deadline, manually *or* automatically), the next generation step fires on its own: **destination locks → Planner + Quartermaster's cost estimate run immediately; once both destination and dates are locked → Quartermaster's checklist generates.** No admin has to remember to come back and tap "Generate."
- **Scout auto-fires** once every active member has answered at least one intake question and no destination decision exists yet — same gate as the manual button, just triggered by the sweep instead of a click.
- **The DATES decision auto-opens** once every active member has submitted availability and the date solver finds at least one real window — same window computation and copy the manual "Put these to a vote" button already used.
- **Date-minority outreach:** when a majority of active members fit the trip's leading date window but 1-2 don't, each of them gets one private, specific message in their own thread asking if they could shift — grounded in their *own* filed availability, so it never invents a reason they can't make it, and never posted more than once per decision.
- **Periodic digest:** every ~30-minute sweep checks whether it's been 3+ hours since the last digest *and* there's been enough new group discussion; if so, an agent posts a short recap plus — only when the chat clearly points to one — a concrete suggestion (e.g. surfacing a repeatedly-mentioned activity as a formal idea before anyone's formally proposed it).
- All of the above is Chaser's cron sweep deciding *whether* and *when* to act (plain rules, no LLM); the agents it triggers (Scout, Planner, Quartermaster, Date Outreach, Digest) are the ones that write actual content.

### Destination generation (Scout)
- Gated on having at least one real budget answer — never proposes from thin constraints.
- Weighs the group's aggregated budget ceiling, departure cities, vibe tags, hard nos, **and the trip's own name/original pitch** (so a trip literally called "Bali 2027" doesn't get ignored just because nobody's intake happened to mention it).
- Optional live web research via Tavily; works without it, just with less current pricing/context.
- Three options, each with cost/head, door-to-door travel time, why it fits this specific group, and an honest "who it fits worst."
- Fires from an admin tap, or auto-fires — see [Autonomous coordination](#autonomous-coordination--zero-admin-taps).

### Itinerary, cost, checklist
- **Planner** builds a day-by-day itinerary once a destination is locked, paced to the group's vibe.
- **Quartermaster** estimates a per-head cost range for the locked destination and deterministically flags who it pushes over their (still-private) ceiling — the LLM estimates, arithmetic decides who's over, comparing against the estimate's **midpoint**, not its pessimistic upper bound (comparing against the max flagged almost everyone whenever the range was wide, which it usually is — the midpoint is the realistic single-number read of what the trip will probably actually cost).
- **Quartermaster** also generates a prep checklist (docs / bookings / packing / other), personal + shared.
- All three fire from an admin tap, or cascade automatically the moment the relevant decision(s) lock — see [Autonomous coordination](#autonomous-coordination--zero-admin-taps).

### Budget renegotiation
The other half of the cost estimate actually meaning something: once someone's flagged, they get asked, not just counted.
- A newly-flagged member gets an interactive card in their own You-tab thread — the first "buttons inside a chat bubble" content this app has, not just agent text — asking if they can stretch to the realistic threshold or if it's a hard limit.
- **Yes** updates their budget fact to that threshold and confirms privately — no group post, budget amounts stay exactly as private as everywhere else in the app.
- **Hard no** prompts for a reason inline, then posts it to the group — named, so the admin knows who to coordinate with, but never the actual number — suggesting the group coordinate budgets, adjust dates, or look for cheaper stays.
- One pending ask per member at a time, enforced at the database level; a later re-estimate can ask again once they've answered.

### Accommodations & Travel options
Hotel and transport mentions get their own richer homes instead of sitting in a flat idea inbox.
- **Accommodations**: a hotel link or plain-text mention ("staying at Alaya Ubud") is AI-enriched with a price and city/area (Tavily search + a small extraction call, same whether it came from chat or was added by hand) and grouped by area on its own page — so a multi-city trip's stays sort themselves. Votable; the admin can **lock any number at once**, each with its own date range (a 7-8 day trip commonly books 2-3 different stays across cities — locking was previously all-or-nothing).
- **Travel options**: a flight/bus/train/ferry mention is AI-classified by mode (Air / Road / Water) with timing and price where findable, grouped by mode on its own page. Votable; members **self-assign** to whichever option they're actually on ("I'm on this") — unlike accommodations, travel genuinely splits, since some fly and some drive. The admin can lock any number at once.
- Both reuse the same enrichment pattern: OG-tag scraping for a link's title/image, Tavily for live context, and a model call that only ever tidies what the search actually found — never invents a price, area, or mode.

### Bookings & Ideas
- **Bookings**: a flat, generic checklist for logistics items (anything not already covered above) with a per-member "booked" chip and one-tap nudges — links out to Accommodations and Travel options rather than duplicating them.
- **Ideas**: an inbox for pasted links (Instagram/YouTube/anything) *or* plain text (no link required) that becomes a votable card — activities and places only now that stays and travel have their own dedicated homes above.
- Both fully admin-deletable behind a destructive confirm, same as decisions.

### Member management
- Admin can remove a member — and it's a *real* removal: their facts, availability, votes, idea votes, and booking status are erased, and anything not locked in yet (an open destination vote, a cost estimate) is regenerated so the result reflects who's actually still in the group.
- Admin can delete the entire trip — a genuine hard delete (every child table cascades off `trips.id`), gated behind a destructive confirm.
- The room only opens once there are at least 3 people total (admin included) — a 1-2 person "group" doesn't need a coordination agent.

### UI polish
- Illustrated, distinctly-themed empty states across every screen (no page ever renders a bare "nothing here" line).
- `loading.tsx` skeletons on every route segment that fetches before first paint.
- In-app confirm sheets for every destructive action (no native `window.confirm`).
- A tri-state calendar, a real budget slider, destination cards matching the original hi-fi mockups.

---

## Tech stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | **Next.js 16** (App Router) | Server Components for data-heavy pages, Route Handlers for mutations |
| Language | **TypeScript 5** (strict) | |
| UI | **React 19**, **Tailwind CSS v4** (`@theme` tokens), `tw-animate-css`, `lucide-react` | Warm paper/plum/signal-green design system, hand-drawn SVG illustrations, no external UI kit |
| Backend / DB | **Supabase** — Postgres, Auth (Google OAuth), Realtime | Row-Level Security everywhere; a custom broadcast layer covers what RLS-gated `postgres_changes` can't reach for members (see [Architecture](#architecture)) |
| AI | **Vercel AI SDK v7** + **Google Gemini 3.6 Flash** (`@ai-sdk/google`) | One model across every agent; `generateObject` for structured output, `generateText` for the Q&A surface |
| Search | **Tavily API** (optional) | Live web context for Scout's destination research, and for Accommodations/Travel options' price/area/mode enrichment (`lib/search/tavily.ts`, one shared client); the app degrades gracefully without it |
| Background jobs | **Inngest** | Cron-driven Chaser sweep (deadline nudges/auto-lock), every 30 minutes |
| Validation | **Zod 4** | Every mutating API route parses its body through a schema in `lib/validation.ts` |
| Testing | **Vitest** | 383 tests across 70 files — pure logic and API routes are unit-tested; no component/E2E layer yet |
| Containerization | **Docker** (multi-stage, standalone output) | Optional — Vercel needs none of this; see [Docker](#docker) |

---

## Architecture

```mermaid
flowchart TB
    subgraph Client["Browser"]
        RSC["Server-rendered pages<br/>(React Server Components)"]
        CC["Client components<br/>(chat feed, calendars, sheets)"]
    end

    subgraph Next["Next.js 16 (Vercel)"]
        Pages["App Router pages<br/>app/trip/[tripId]/..."]
        API["Route Handlers<br/>app/api/trips/[tripId]/..."]
    end

    subgraph Supabase["Supabase"]
        Auth["Auth<br/>Google OAuth — admin & members alike"]
        PG[("Postgres<br/>23 tables, RLS on every one")]
        RT["Realtime<br/>custom broadcast channel"]
    end

    subgraph Agents["AI agent layer (lib/agents/*)"]
        Scribe["Scribe — gate + extract facts/availability/ideas from every message"]
        Scout["Scout — destination generation"]
        Planner["Planner — itinerary"]
        QM["Quartermaster — cost estimate + prep checklist"]
        Chaser["Chaser — deadline + quorum auto-lock, auto-generation triggers (no LLM)"]
        DateOutreach["Date Outreach — private nudge for date-minority members"]
        Digest["Digest — periodic recap + suggestion"]
        Concierge["Concierge — kickoff & lifecycle announcements"]
    end

    subgraph External["External services"]
        Gemini["Google Gemini 3.6 Flash<br/>via Vercel AI SDK"]
        Tavily["Tavily<br/>(optional web search)"]
        Inngest["Inngest<br/>cron: */30 * * * *"]
    end

    CC -->|fetch| API
    RSC -->|server-side query| PG
    API -->|service-role or RLS-bound client| PG
    API --> Agents
    Agents --> Gemini
    Scout -.-> Tavily
    API -->|postAgentMessage + broadcastTripChange| PG
    PG --> RT
    RT -->|"broadcast('change')"| CC
    CC -.->|polling fallback| API
    Inngest -->|sweep| Chaser
    Chaser -->|quorum/deadline lock| API
    Chaser -->|auto-trigger| Scout
    Chaser -->|majority fits, 1-2 don't| DateOutreach
    Chaser -->|3h + volume gate| Digest
    API -->|decision just locked| Planner
    API -->|decision just locked| QM
    Auth --- PG
    Pages --> RSC
```

**Why a custom broadcast layer instead of just `postgres_changes`:** every RLS policy on `messages`, `decisions`, `votes`, etc. grants `SELECT` to a trip's own `admin_user_id` — never to a plain member, even though members now authenticate through real Supabase Auth sessions too. Rather than loosen RLS, mutating routes explicitly `broadcast()` a `{type, ...payload}` event on a per-trip channel after every write, and every page that needs to feel "live" (the room, both lobbies, Plan via `RealtimeRefresh`) subscribes to it — with an interval-based polling fallback wherever a missed broadcast would otherwise leave a screen stuck (both lobbies).

**Auth model:** a single `getAuthUser()` (Supabase Auth session) answers "who's signed in" for both audiences. `resolveCaller(tripId)` does one lookup — auth user → that trip's `members` row by email — and returns `{ id, status, role }`; `role` is the one source of truth for admin-only UI/actions inside any page both audiences can reach. `requireTripOwner(tripId)` is the separate, stricter check for service-role routes that bypass RLS entirely (member management, trip deletion, decision deletion, Scout/Planner/Quartermaster generation) — it independently verifies `trips.admin_user_id === auth.uid()` since the service client gets no RLS protection for free.

---

## The agents

Every agent follows the same **deterministic core, LLM shell** principle: anything with a right answer (date math, quorum, who's over budget, when to auto-lock) is plain arithmetic; the LLM is only ever the one deciding *what to say* or *what to propose*, never the one deciding *who's right*.

| Agent | Posts as | Trigger | What it does | LLM? |
|---|---|---|---|---|
| **Concierge** | `concierge` | Room opens, decision opened/locked/reopened/deleted, intake submitted | Narrates lifecycle events into the room/thread with a receipt — nothing happens silently | No — templated |
| **Scribe** | `scribe` | Every new message | Gates ("does this contain extractable info?"), then extracts facts/availability/ideas attributed to the author only and files them — a stay/travel idea routes straight to Accommodations/Travel options instead, AI-enriched with price/area/mode on the spot; retries once with its own invalid output + the exact validation error echoed back if extraction fails, and normalizes known schema-shape mistakes before Zod validates rather than trusting a retry alone; posts a receipt — or an honest "couldn't pin it down" reply if it still can't parse the message | Yes — gate + extraction |
| **Scout** | `scout` | Admin requests destination options, or auto-fires once every active member has answered intake and no destination decision exists | Deterministic budget-ceiling gate → optional Tavily search → 3 destination options with cost/travel/reasoning, weighing the trip's own name/pitch alongside aggregated facts | Yes — `generateObject` |
| **Planner** | `planner` | Admin requests an itinerary, or auto-fires the instant the destination decision locks | Day-by-day itinerary paced to party size, vibe, hard constraints | Yes — `generateObject` |
| **Quartermaster** | `quartermaster` | Admin requests a cost estimate/checklist, or auto-fires on decision lock (estimate: destination locks; checklist: destination + dates both locked) | LLM estimates a per-head range; **deterministic** arithmetic (not the model) decides who's over budget, comparing against the range's midpoint. Also generates the prep checklist, and triggers a private budget-check ask for anyone newly flagged | Yes (estimate) + No (flagging) |
| **Date Outreach** | `chaser` | Chaser's sweep — a majority of active members fit the trip's leading date window but 1-2 don't; fires once per member per decision | Privately asks each member outside the window if they could shift, grounded in their own filed availability — posted to their own thread, never the group | Yes — `generateText` |
| **Digest** | `concierge` | Chaser's sweep — ≥3h since the last digest *and* ≥5 new member messages in the group | Recaps recent group discussion and, only when it clearly points to one, adds a concrete suggestion | Yes — `generateText` |
| **Chaser** | *(system — triggers the agents above)* | Cron, every 30 minutes | Pure rule sweep: deadline reminders/auto-lock inside a 24h window, quorum auto-lock the instant everyone's voted, auto-runs Scout / auto-opens the DATES decision once everyone's answered, nudge tiers for non-responders, and decides when Date Outreach / Digest should speak | No — pure rules; delegates all content-writing to the agents it triggers |
| *(Q&A)* | — | "Ask the agent" from the composer | Answers plain-language questions about costs/dates/who's-said-what strictly from what the deterministic layer already computed — never does its own arithmetic | Yes — `generateText` |

---

## Database schema

23 tables, every one RLS-enabled, pulled directly from the live Supabase schema.

```mermaid
erDiagram
    trips ||--o{ members : "has"
    trips ||--o{ messages : "has"
    trips ||--o{ facts : "has"
    trips ||--o{ availability : "has"
    trips ||--o{ decisions : "has"
    trips ||--o{ agent_runs : "logs"
    trips ||--o| itineraries : "has"
    trips ||--o{ ideas : "has"
    trips ||--o{ tasks : "has"
    trips ||--o{ bookings : "has"
    trips ||--o| cost_estimates : "has"
    trips ||--o{ threads : "has"
    trips ||--o{ budget_checks : "has"
    trips ||--o{ accommodations : "has"
    trips ||--o{ travel_options : "has"

    members ||--o{ facts : "files"
    members ||--o{ availability : "submits"
    members ||--o{ votes : "casts"
    members ||--o{ idea_votes : "casts"
    members ||--o{ tasks : "assigned"
    members ||--o{ threads : "owns"
    members ||--o{ messages : "authors"
    members |o--o{ decisions : "locked_by"
    members ||--o{ ideas : "posts"
    members ||--o{ booking_status : "marks"
    members ||--o{ budget_checks : "asked"
    members ||--o{ accommodations : "suggests"
    members ||--o{ accommodation_votes : "casts"
    members ||--o{ travel_options : "suggests"
    members ||--o{ travel_option_votes : "casts"
    members ||--o{ travel_option_members : "joins"

    decisions ||--o{ votes : "receives"
    decisions ||--o{ date_outreach_nudges : "gates"
    members ||--o{ date_outreach_nudges : "nudged"
    ideas ||--o{ idea_votes : "receives"
    accommodations ||--o{ accommodation_votes : "receives"
    travel_options ||--o{ travel_option_votes : "receives"
    travel_options ||--o{ travel_option_members : "carries"
    bookings ||--o{ booking_status : "tracked_by"
    threads ||--o{ messages : "contains"
    messages |o--o{ facts : "source_message_id"
    facts |o--o{ facts : "superseded_by"

    trips {
        uuid id PK
        text name
        text rough_intent
        uuid admin_user_id "auth.users(id)"
        text invite_code UK
        text status "lobby | active | closed"
        bool joining_open
        text[] vibe
        text budget_hint
        text agent_tone "efficient | warm | dry"
        int preferred_trip_days "2|3|5|7|10|14, default 7"
    }
    members {
        uuid id PK
        uuid trip_id FK
        text display_name
        text email
        text role "member | admin"
        text status "active | removed"
        int nudge_tier "0-3"
        timestamptz flagged_at
    }
    messages {
        uuid id PK
        uuid trip_id FK
        uuid thread_id FK "nullable — null = group lane"
        text lane "group | thread"
        text author_type "member | agent"
        uuid author_id FK "nullable for agent"
        text agent_name "concierge|scribe|chaser|scout|planner|quartermaster"
        text body
        jsonb metadata
    }
    facts {
        uuid id PK
        uuid trip_id FK
        uuid member_id FK
        text category "budget|departure_city|vibe|hard_no"
        text type "HARD | SOFT"
        jsonb value
        numeric confidence
        text source "intake|manual|extract"
        uuid source_message_id FK
        uuid superseded_by FK "self-ref"
    }
    availability {
        uuid id PK
        uuid trip_id FK
        uuid member_id FK
        date start_date
        date end_date
        text strength "free|partial|blocked"
    }
    decisions {
        uuid id PK
        uuid trip_id FK
        text type "DATES|DESTINATION|BUDGET|STAY|ACTIVITY|CUSTOM"
        text state "DRAFT|OPEN|VOTING|LOCKED|REOPENED"
        jsonb options
        text quorum_rule
        timestamptz deadline
        text default_on_silence
        text locked_option
        text rationale
        uuid locked_by FK
        timestamptz reminded_at
    }
    votes {
        uuid id PK
        uuid decision_id FK
        uuid member_id FK
        text option_id
        bool is_veto
    }
    date_outreach_nudges {
        uuid id PK
        uuid decision_id FK
        uuid member_id FK "unique(decision_id, member_id) — never nudged twice"
    }
    budget_checks {
        uuid id PK
        uuid trip_id FK
        uuid member_id FK
        int threshold_amount
        text status "pending | yes | no"
        text reason "the hard-no reason, if any"
        timestamptz answered_at
    }
    accommodations {
        uuid id PK
        uuid trip_id FK
        uuid member_id FK
        text name
        text url
        text price "AI-derived or manual, free text"
        text area "AI-derived city/area"
        text image_url
        text source "chat | manual"
        bool locked
        date start_date "set when locked"
        date end_date "set when locked"
    }
    accommodation_votes {
        uuid id PK
        uuid accommodation_id FK
        uuid member_id FK
    }
    travel_options {
        uuid id PK
        uuid trip_id FK
        uuid member_id FK
        text name
        text mode "air | road | water"
        text timing
        text price
        text url
        text source "chat | manual"
        bool locked
    }
    travel_option_votes {
        uuid id PK
        uuid travel_option_id FK
        uuid member_id FK
    }
    travel_option_members {
        uuid id PK
        uuid travel_option_id FK
        uuid member_id FK "who's actually on this leg"
    }
    threads {
        uuid id PK
        uuid trip_id FK
        uuid member_id FK
    }
    ideas {
        uuid id PK
        uuid trip_id FK
        uuid member_id FK
        text url "nullable — a text-only idea has no link"
        text title
        text note
        text image_url
        text category "activity | stay | travel"
    }
    idea_votes {
        uuid id PK
        uuid idea_id FK
        uuid member_id FK
    }
    tasks {
        uuid id PK
        uuid trip_id FK
        uuid member_id FK "nullable — null = shared"
        text title
        text category "docs|booking|packing|other"
        date due_date
        bool done
    }
    bookings {
        uuid id PK
        uuid trip_id FK
        text item
        date deadline
    }
    booking_status {
        uuid id PK
        uuid booking_id FK
        uuid member_id FK
        bool booked
    }
    cost_estimates {
        uuid id PK
        uuid trip_id FK "unique"
        text destination
        int min_per_head
        int max_per_head
        text currency
        text assumptions
    }
    itineraries {
        uuid id PK
        uuid trip_id FK "unique"
        text destination
        jsonb days
    }
    agent_runs {
        uuid id PK
        uuid trip_id FK
        text agent
        text trigger
        int input_tokens
        int output_tokens
        numeric cost
        int latency_ms
        text outcome "success|error|skipped"
    }
```

**Notable design choices in the schema itself:**
- `facts.superseded_by` is a self-referencing FK — a chat correction to a "current answer" category (budget, departure city) supersedes the prior fact rather than sitting alongside it; additive categories (vibe, hard_no) are left alone on purpose.
- `messages.lane` + `thread_id` is how the group feed and every member's private 1:1 thread share one table without ever leaking into each other.
- `agent_runs` is a full LLM observability log — tokens, estimated cost, latency, outcome — per call, per agent, per trip.
- Every child table cascades on `trip_id` (`on delete cascade`), which is what makes trip deletion a genuine one-shot teardown with zero orphaned rows.
- `date_outreach_nudges` has no `trip_id` of its own (same shape as `votes` — reachable only through `decision_id`); its `unique(decision_id, member_id)` constraint is the entire "never nudge the same person twice about the same decision" guarantee, enforced by the database rather than application logic.
- `budget_checks` has a **partial unique index** (`unique(trip_id, member_id) where status = 'pending'`) — at most one open ask per member at a time, enforced by the database; a later re-estimate can ask again once they've answered, never piles a second ask on an unanswered one.
- `travel_option_members` is a plain many-to-many join with no extra columns — unlike accommodations (everyone's assumed together), travel genuinely splits, so a member can appear against more than one option (flight there, train back).
- `ideas.category` still technically allows `'stay'`/`'travel'` at the database level, but nothing files into those values anymore now that both have their own dedicated tables — left alone rather than tightened, since relaxing a constraint later is free and tightening one on a live table isn't.

---

## Getting started

### Prerequisites
- Node.js 20+
- A [Supabase](https://supabase.com) project
- A [Google Gemini API key](https://aistudio.google.com/apikey)
- A Google OAuth client, for Supabase Auth's Google provider (steps below)
- *(optional)* A [Tavily](https://app.tavily.com) API key for live destination research
- *(optional, production only)* An [Inngest](https://inngest.com) account, for the Chaser cron

### 1. Clone and install

```bash
git clone <this-repo>
cd caravan
npm install
cp .env.example .env.local
```

### 2. Supabase — database + auth

1. Create a project at [supabase.com](https://supabase.com).
2. Run every file in `supabase/migrations/` against it, **in filename order** — either `supabase db push` via the [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started), or paste each one into the dashboard's SQL editor.
3. From **Project Settings → API**, copy the project URL, the `anon` public key, and the `service_role` key into `.env.local` (below). The service-role key is server-only — it bypasses RLS and must never reach the client.

### 3. Google OAuth — where the client ID/secret actually live

**They don't go in this codebase at all** — not in a file, not in an env var. Supabase Auth owns the entire OAuth handshake with Google; the app only ever calls `supabase.auth.signInWithOAuth({ provider: "google" })` and lets Supabase redirect, exchange the code, and hand back a session. That's why a `grep` for `client_id`/`clientId` across this repo turns up nothing — it's not a gap, that credential simply has no reason to ever touch application code.

1. In [Google Cloud Console](https://console.cloud.google.com/apis/credentials), create an **OAuth 2.0 Client ID** (Application type: **Web application**).
2. Under **Authorized redirect URIs**, add your Supabase project's own callback — **not** this app's `/auth/callback` route:
   ```
   https://<your-project-ref>.supabase.co/auth/v1/callback
   ```
3. In the Supabase dashboard, go to **Authentication → Sign In / Providers → Google**, toggle it on, and paste the **Client ID** and **Client Secret** from step 1 there. This is the one and only place those two values are ever configured.
4. Separately, in **Authentication → URL Configuration**, add this app's own callback as an allowed redirect URL (this is the one Supabase-related URL that *is* referenced in code, in `app/auth/callback/route.ts`):
   ```
   http://localhost:3000/auth/callback        # dev
   https://<your-domain>/auth/callback         # production
   ```

### 4. Environment variables

Fill in `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=          # your Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=     # Supabase public anon key
SUPABASE_SERVICE_ROLE_KEY=         # Supabase service role key (server-only, never exposed to the client)
GOOGLE_GENERATIVE_AI_API_KEY=      # Gemini key from https://aistudio.google.com/apikey
TAVILY_API_KEY=                    # optional — Scout works without it, just with less live context
```

Nothing Inngest- or Google-OAuth-client-related belongs in this file — see §3 above for Google, and §5 below for Inngest.

### 5. Inngest — where the cron setup goes

The whole integration is two files: `lib/inngest/client.ts` (defines the client + the trip ID) and `app/api/inngest/route.ts` (the single HTTP endpoint — `serve()` from the `inngest/next` package turns it into `GET`/`POST`/`PUT` handlers). `lib/inngest/functions.ts` defines the actual cron job (`chaser-sweep`, `*/30 * * * *`), which per active trip runs five sweeps in sequence: deadline/quorum decision lock, auto-generation (Scout/DATES), date-minority outreach, the periodic digest, and intake nudges.

- **Local dev:** run the Inngest Dev Server alongside `next dev` — it auto-discovers `/api/inngest` with zero config, no env vars needed:
  ```bash
  npx inngest-cli@latest dev
  ```
- **Production:** create an app at [app.inngest.com](https://app.inngest.com), point it at your deployed `/api/inngest` URL, and set these two on your host (Vercel dashboard, etc.) — the SDK picks them up from `process.env` automatically, there's no code change:
  ```bash
  INNGEST_EVENT_KEY=
  INNGEST_SIGNING_KEY=
  ```
  Without these set in production, the endpoint still exists but Inngest Cloud can't authenticate to it, so the Chaser sweep silently never fires — decisions with deadlines just won't auto-lock or nudge.

### 6. Run it

```bash
npm run dev       # start the dev server
npm test          # run the Vitest suite
npm run lint       # ESLint
npm run build      # production build
```

---

## Docker

Only the Next.js app itself is containerized — Supabase (Postgres/Auth/Realtime) stays an external hosted project either way, Docker or not, so there's no local Postgres container to wire up here. Everything under [Getting started](#getting-started) still applies; you still need a real Supabase project, a Gemini key, `.env.local` filled in, and migrations run against it.

The `Dockerfile` is a 3-stage build (`deps` → `builder` → `runner`) that ends in a `node server.js` runtime, not a full `node_modules` + `next start` — [`next.config.ts`](next.config.ts) sets `output: "standalone"`, which traces exactly which dependencies each route needs and copies only those into the final image. Verified locally: **~300MB**, serves traffic immediately on start.

**One real gotcha, handled for you:** `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` get inlined into the client JS bundle *at build time* — unlike every other env var this app uses (service role key, Gemini, Tavily, Inngest), which are read at runtime. So those two specifically have to be passed as Docker **build args**, not just runtime `-e`/`env_file` vars, or the client bundle silently ships with empty values. Both the `Dockerfile` and `docker-compose.yml` are already wired for this — you don't need to do anything differently, just make sure they're set in whichever env file you point at.

### With Docker Compose (recommended)

```bash
npm run docker:up          # build + run, reading .env.local for both build args and runtime env
# or directly:
docker compose --env-file .env.local up --build
```

The app is then up at `http://localhost:3000`.

### With plain Docker

```bash
docker build \
  --build-arg NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY \
  -t caravan .

docker run -p 3000:3000 --env-file .env.local caravan
```

### Deploying the image

Push the built image to any registry (Docker Hub, GHCR, ECR, ...) and run it on any container host (Fly.io, Railway, Cloud Run, ECS, a plain VM with `docker run`, ...). Set the same server-only env vars from [Getting started](#getting-started) on the host at runtime, and rebuild whenever `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY` change (they're baked in, not reconfigurable post-build). If you deploy this way instead of to Vercel, you're also responsible for pointing an [Inngest](#5-inngest--where-the-cron-setup-goes) app at wherever `/api/inngest` ends up publicly reachable — that part doesn't change based on how the container itself is hosted.

---

## Project structure

```
app/
  trips/                       # my-trips list, new-trip wizard, admin lobby
  trip/[tripId]/
    intake/                    # the 5 private questions
    member-lobby/               # member's pre-open waiting screen
    (main)/                     # everything behind the trip shell (tab bar + sidebar)
      room/ plan/ you/ you/scrapbook/ settings/
      destination/ facts/ bookings/ ideas/ cost/
      accommodations/ travel-options/
      decisions/[decisionId]/
  join/[code]/                 # invite landing → OAuth → auto-join → redirect
  api/trips/[tripId]/...       # every mutation: decisions, votes, intake, ideas,
                                #   bookings, accommodations, travel-options, budget-check,
                                #   member removal, scout/planner/quartermaster
components/caravan/            # the whole design system, organized by domain —
                                #   primitives/ layout/ auth/ intake/ decisions/
                                #   plan/ room/ generate/ sharing/ settings/ shared/
lib/
  agents/                      # Scribe, Scout, Planner, Quartermaster, Chaser,
                                #   Date Outreach, Digest, runtime/ (model, logging, posting)
  dates/                       # date-solver.ts — the deterministic, duration-aware date-window core
  budget/                      # budget.ts, cost-flags.ts, trigger-budget-checks.ts
  decisions/                   # tally-votes.ts, on-decision-locked.ts (the lock → generation
                                #   cascade), refresh-dates-decision.ts, opened-message.ts, decision-titles.ts
  accommodations/, travel/     # extract-accommodation.ts, extract-travel-option.ts — Tavily
                                #   + model enrichment (price/area, mode)
  search/                      # tavily.ts — the one shared Tavily client
  facts/, ideas/, bookings/, threads/, trips/   # small domain-scoped helpers
  auth/                        # session + caller resolution
  supabase/                    # browser / server / service-role clients
  realtime/                    # the custom broadcast layer
  inngest/                     # client, functions (the cron sweep)
  validation.ts                # every Zod schema
  database.types.ts            # hand-maintained row types for every table
supabase/migrations/           # 18 migrations, schema history
docs/design/                   # PRD, UI spec, and a static HTML hi-fi mockup (screens.html)
```

---

## Testing

```bash
npm test
```

383 tests across 70 files. The test strategy follows the deterministic-core/LLM-shell split: pure logic (`lib/dates/date-solver.ts`, `lib/budget/budget.ts`, `lib/budget/cost-flags.ts`, `lib/decisions/tally-votes.ts`, `lib/agents/chaser-rules.ts`, `lib/decisions/on-decision-locked.ts`, ...) and every API route are unit-tested with mocked Supabase/AI-SDK clients; agent LLM calls are tested for their deterministic surrounding logic (gating, prompt construction, fact filing, error handling), not for model output itself. Verified live against a real trip via Supabase MCP is the additional bar used for every agentic-coordination phase — see the commit history for `lib/agents/chaser.ts` and `lib/agents/scribe.ts`. There's no component or end-to-end browser test layer yet — see [Known limitations](#known-limitations--roadmap).

---

## Deployment

Two supported paths — same underlying app either way, same Supabase project, same env vars.

**Vercel** (no Docker involved — this is what `output: "standalone"` in `next.config.ts` is orthogonal to; Vercel builds the app its own way regardless):

1. Import the repo, set the environment variables above in the Vercel dashboard.
2. Point `NEXT_PUBLIC_SUPABASE_URL` / keys at your production Supabase project (run migrations there too).
3. Add your production URL's `/auth/callback` (`https://<your-domain>/auth/callback`) to Supabase's **Authentication → URL Configuration** allowed redirects — the Google Cloud Console side doesn't change per-deployment, it always points at Supabase's own callback (see [§3 above](#3-google-oauth--where-the-client-idsecret-actually-live)).
4. Set `INNGEST_EVENT_KEY` / `INNGEST_SIGNING_KEY` and point an Inngest app at `/api/inngest` (see [§5 above](#5-inngest--where-the-cron-setup-goes)) so the Chaser sweep actually fires every 30 minutes in production.

**Any container host** (Fly.io, Railway, Cloud Run, ECS, a bare VM, ...) — build the image per [Docker](#docker), then follow the same 4 steps above; nothing about Supabase, Google OAuth, or Inngest setup changes based on how the app itself is hosted.

---

## Design principles

These held across the whole build and are worth knowing before extending it:

- **Deterministic core, LLM shell** (the load-bearing one). Date math, quorum, budget-over/under, auto-lock timing — plain code. The LLM only ever writes destination reasoning, itinerary content, and chat replies; it's never the thing deciding whether someone's over budget.
- **Private inputs, public consensus.** Budget is the one piece of data that never surfaces to anyone but its owner, anywhere in the product — not the admin, not a debug view, not an "everyone's answers" page.
- **Nothing happens silently.** Every state change — a decision locking, reopening, or being deleted; a member being removed; a fact getting corrected — posts a receipt into the room or thread it affects.
- **The room only opens once there's a group.** A trip stays in `lobby` until an explicit admin action, and that action itself is gated (3+ people) — no slow trickle-in, no half-empty room making decisions.

---

## Known limitations / roadmap

Kept here on purpose so this stays an honest README, not a marketing page:

- **No email/push notifications yet.** Some UI copy ("you'll get an email") is aspirational — nudges currently surface only inside the app (room messages, `nudge_tier`), there's no actual email delivery wired up.
- **No component or E2E test layer.** Coverage is strong on logic and API routes; UI regressions have to be caught by hand.
- **Itinerary is regenerate-only.** Planner rebuilds the whole itinerary each time rather than supporting inline day edits.
- **Single AI provider.** Everything runs on one Gemini model; swapping providers/tiers per-agent is a one-line change (the AI SDK abstracts it) but isn't wired up as a runtime option.
- **No dark theme.** The design system is a single warm paper/plum palette.
- **Autonomous-coordination thresholds are fixed constants, not admin-configurable.** The digest's 3h/5-message gate, date outreach's "majority but not everyone" bar, and the budget-check midpoint threshold all live in code, not a per-trip setting.
- **Accommodation/travel enrichment is best-effort.** Price, area, and timing come from a Tavily search + one model call; without a Tavily key, or if the search turns up nothing usable, those fields save as `null` rather than blocking the entry — the name and link (if any) always save regardless.

---

## License

[MIT](LICENSE) — do what you want with it, including in production, with attribution and no warranty.
