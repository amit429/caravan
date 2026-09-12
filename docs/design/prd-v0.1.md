# Caravan — Agentic Group Trip Planner

**Working title:** Caravan *(alternatives: Kaafila, Huddle, Sherpa, Tripwire, Convoy)*
**Version:** PRD v0.1 — ideation draft
**Owner:** Amit
**Status:** Pre-build, scoping

---

## 1. TL;DR

A link-joinable web app where a friend group plans a trip in a shared chat, except the person doing all the coordination work is not a person — it is a team of agents. One admin creates a trip and shares a room code. Everyone else joins from a browser with just a name and email. The agents extract constraints from what people say, run the date math, force decisions to close on deadlines, propose destinations with reasoning, build the itinerary, and chase the stragglers.

**The thing being replaced is not the group chat. It is the unpaid project manager inside it.**

---

## 2. Problem Statement

Every group trip has a "trip mom" — one person who DMs everyone for dates, aggregates them by hand, proposes destinations, absorbs 200 forwarded Instagram reels, builds the itinerary, tracks who has booked, and sends the reminders. The work is invisible, unthanked, and heavy enough that it frequently kills trips before they happen.

The failure is not information capture. Group chats capture plenty. **The failure is convergence.** A group chat has no mechanism to close a question. "Anyone free 2nd week of Dec?" gets four replies, two jokes, and then dies. Three weeks later someone says "so are we doing this or not?" and the cycle restarts. Meanwhile prices go up and the window closes.

**Cost of not solving it:** trips silently die; when they don't, one person pays a 10–20 hour coordination tax and often eats financial risk (booking first, chasing money later).

**Evidence to collect before build:** interview 8–10 people who have organised a group trip in the last year; count the DMs and the elapsed time between "let's go somewhere" and "dates locked."

---

## 3. Product Thesis — the three bets

Everything in this PRD follows from three bets. If one is wrong, the product changes shape.

**Bet 1 — Convergence, not note-taking.**
An agent that summarises the chat is a toy. An agent that says *"3 of 5 want Goa, Rhea's budget caps at ₹15k so Nov 12–15 not Dec 20–24, voting closes Friday 6pm, silence counts as yes"* is the organiser. Deadlines, quorum rules, and defaults-on-silence are the core mechanic — not the LLM.

**Bet 2 — Private inputs, public consensus.**
The real reason group trips stall is social, not logistical. People don't say "I can't afford ₹20k" in a group of eight. Every member gets a **private 1:1 lane** with the agent. Budgets, hard no-go dates, and dealbreakers go in privately; only aggregates and the resulting decision surface publicly ("the plan needs to land under ₹16k/head to keep everyone in").

**Bet 3 — The state is the product, chat is just the input.**
A living, structured, always-visible **Trip Brain** (dates, budget band, party, prefs, decisions, open items) sits beside the chat. Chat writes to it, agents read from it, every fact is tappable-to-correct and traceable to the message it came from. This is what makes the AI trustworthy instead of spooky.

---

## 4. Target Users

| Persona | Who | What they need |
|---|---|---|
| **The Organiser (admin)** | Creates the trip, currently does all the work | To stop being the bottleneck without losing control. Wants override power. |
| **The Passive Majority** | "Anything works for me bro" | Zero-friction input. Tap, don't type. Will not install an app. Will ignore 3 nudges. |
| **The Constrained One** | Tight budget, fixed leave dates, dietary/medical constraints | To register a hard limit without an awkward public conversation. |
| **The Enthusiast** | Sends 40 reels and 6 itineraries | A place to dump ideas that actually gets read and ranked, not lost in scroll. |
| **The Ghost** | Says yes, vanishes, resurfaces at booking | To be auto-decremented from the plan gracefully, and re-onboarded in one screen. |

Primary optimisation target for v1: **the Organiser** (they create the room and drive adoption) and **the Passive Majority** (if they don't respond, nothing works).

---

## 5. Goals

1. **Cut organiser effort by 70%.** Measured as organiser's share of total messages sent in a trip room (<30%) and self-reported time.
2. **Get from trip creation to locked dates in under 72 hours** for a group of 5+, vs. the current multi-week drift.
3. **Get 70% of invited members to submit their constraints within 24h of joining** — via tap-first private intake, not free-text chat.
4. **Every trip reaches at least three locked decisions** (dates, destination, budget band) without an organiser having to manually tally anything.
5. **Zero-friction join:** invited → contributing in under 60 seconds, no signup, no app install.

## 6. Non-Goals (v1)

1. **Booking or payments.** No flight/hotel inventory, no checkout, no affiliate integrations. Inventory APIs are a swamp of approvals and stale pricing; it would eat the entire build. v1 hands off with links and deadlines.
2. **Replacing the group chat for banter.** The group will keep WhatsApp. Caravan is the decision surface, not the social one. Fighting this is unwinnable.
3. **Native mobile apps.** The entire premise is a link that works instantly. PWA-installable, nothing more.
4. **Real-time in-trip features** (live location, day-of coordination, expense capture on the road). Different product, different session pattern.
5. **Public/discoverable trips, social feed, influencer itineraries.** No marketplace dynamics in v1.
6. **Multi-currency / international group splitting.** India-first, INR-first.

---

## 7. Core Concepts

These four objects are the product. Build these right and the features fall out.

### 7.1 Trip Brain
The canonical structured state of the trip. Rendered as a live panel next to the chat.

```
TripBrain {
  party:        [ {member, status: in|out|maybe|ghost, joined_at} ]
  dates:        { candidate_windows[], locked_window?, per_member_availability[] }
  budget:       { per_member_band[] (private), group_ceiling, locked_budget? }
  origin:       [ {member, departure_city} ]
  preferences:  { vibe[], activities[], pace, accommodation_style }
  constraints:  [ {member, type: HARD|SOFT, category, value, source_message_id} ]
  destination:  { shortlist[], locked? }
  itinerary:    { days[] }
  decisions:    [ Decision ]
  open_items:   [ {question, blocking_on[], deadline} ]
}
```

Every field carries **provenance** (which message/intake answer produced it) and **confidence**. Every field is one tap to edit. Nothing the AI infers is ever silently authoritative.

### 7.2 Decision Object — the anti-WhatsApp mechanic
A first-class record, not a chat message. This is what makes the product work.

```
Decision {
  id, type: DATES | DESTINATION | BUDGET | STAY | ACTIVITY | CUSTOM
  state: DRAFT → OPEN → VOTING → LOCKED → REOPENED
  options[]              // agent-generated or member-proposed
  quorum_rule            // e.g. simple majority of ACTIVE members
  deadline               // hard timestamp
  default_on_silence     // "abstain counts as flexible" / "counts for leading option"
  votes[]                // {member, option, weight, is_veto}
  locked_by              // agent | admin override
  rationale              // agent's written justification, shown in chat
}
```

Rules:
- **Silence has a timer and a meaning.** No vote by the deadline → counted per `default_on_silence`. This single rule is what breaks the stall.
- **Hard constraints are vetoes, soft ones are weights.** "I cannot travel Nov 20–25" can never be overridden by a vote. "I'd prefer mountains" can.
- **Admin can always override** a lock, with an audit trail entry.

### 7.3 The Private Lane
Each member has a 1:1 thread with the agent inside the trip. Used for: intake questionnaire, budget, sensitive constraints, nudges, and "do you actually want to be on this trip?" Only derived aggregates ever reach the group lane, and members can mark any fact as *shareable* explicitly.

### 7.4 Deterministic Core, LLM Shell
**The LLM never does arithmetic or set logic.** Date intersection, budget aggregation, vote tallying, and quorum are plain deterministic code operating on Trip Brain. The LLM's jobs are: extract structure from language, generate options, write commentary, and choose when to act. This is the single most important engineering constraint in the document — it is what keeps the product from being confidently wrong about whether everyone is free on the 14th.

---

## 8. Agent Architecture

Six agents. Resist adding more — each one needs a reason its context differs from the others.

| Agent | Role | Triggered by | Tools | Lane |
|---|---|---|---|---|
| **Concierge** (orchestrator) | Routes work, decides who acts and when, owns the group-facing voice | Every event | delegate(), post(), read/write TripBrain | Group |
| **Scribe** (extractor) | Turns messages into structured constraints, prefs, dates, budgets | Message batches (debounced) | write TripBrain, flag_ambiguity() | Silent |
| **Chaser** (facilitator) | Owns deadlines, quorum, nudges, closing decisions, ghost detection | Cron + decision state changes | create_decision(), nudge(), close_decision() | Both |
| **Scout** (destination) | Generates 3 destination options with tradeoff commentary against real constraints | Chaser request, or on dates lock | web_search, cached destination KB, TripBrain read | Group |
| **Planner** (itinerary) | Day-by-day plan honouring pace, party size, must-dos | Destination lock | web_search, maps, TripBrain | Group |
| **Quartermaster** (logistics) | Prep checklist, booking deadlines, docs, packing, per-person to-dos | Destination + dates lock | create_task(), remind(), email | Both |

**Deferred to v2:** *Treasurer* (per-head estimates, split tracking, settle-up). Note: this overlaps heavily with BillBreak — consider whether Treasurer is a Caravan module or a BillBreak embed. Don't build it twice.

### 8.1 Trigger model
Agents are **event-driven, not chat-turn-driven**. Three trigger classes:

1. **Message events** → debounced batch (30s idle OR 10 messages) → cheap gate model ("does this batch contain a constraint, preference, date, or decision?") → Scribe only if yes. Most banter costs nothing.
2. **State transitions** → e.g. `dates.locked` fires Scout; `destination.locked` fires Planner + Quartermaster.
3. **Timers** → Chaser cron: deadline approaching (T-24h nudge), deadline hit (close + announce), silence detection (48h no input → private nudge → 96h → mark ghost, ask admin).

### 8.2 Agent behaviour rules (non-negotiable)
- An agent **never posts twice in a row** in the group lane without a member message or a state change between. Chattiness kills the vibe.
- Every agent action that changes Trip Brain posts a **one-line receipt** in chat with an undo affordance.
- The Concierge has a personality (dry, efficient, mildly funny) but is **never sycophantic and never pretends to be a person**.
- On low-confidence extraction, the agent **asks in the private lane**, not the group lane.
- Hard constraints are surfaced as constraints without attribution unless the member opted to share ("someone has a hard ceiling around ₹15k" vs "Rhea can only spend ₹15k").

---

## 9. Feature Requirements

### P0 — Must have (v1 cannot ship without these)

**F1. Trip creation + room code**
Admin signs in (Google OAuth), creates a trip with a name and optional rough intent. Gets a 6-character code and a share link.
- [ ] One admin can own multiple trips; one person can be a member of multiple trips
- [ ] Share link opens straight to join screen, prefilled with trip name
- [ ] Admin can close joining, remove a member, and reopen the room

**F2. No-login join**
Given a valid invite link, when a visitor enters name + email, then they are inside the room and can post within 60 seconds.
- [ ] Duplicate email rejoining the same trip resumes the same identity, not a new member
- [ ] A signed device token persists identity across sessions on that browser
- [ ] Email is used for digests and re-entry links, never as a password
- [ ] Rejoin-from-email link works on a new device

**F3. Group chat lane**
Real-time (or near-real-time) messages, member list, typing presence, agent messages rendered distinctly from human messages.
- [ ] Agent messages visually separated with a receipt/undo pattern
- [ ] Message history persists and is readable by a member who joins late
- [ ] Late joiner gets a "here's where we're at" Trip Brain summary, not 400 messages to scroll

**F4. Private lane + tap-first intake**
On join, member is dropped into a 5-question intake in the private lane. Tap-first, free text optional.
- Questions: *availability windows*, *budget band*, *departure city*, *vibe (multi-select)*, *any hard nos*
- [ ] Completable in under 90 seconds with only taps
- [ ] A member can skip and be nudged later
- [ ] Budget is stored privately; group sees only the derived ceiling
- [ ] Answers write directly to Trip Brain with `source: intake`, confidence 1.0

**F5. Scribe extraction with provenance**
Given a group message containing constraints, when the batch is processed, then Trip Brain updates and a receipt is posted.
- [ ] Extracted facts link to the source message
- [ ] Any member can correct any fact about themselves in one tap; corrections outrank extraction permanently
- [ ] Hard vs soft classification is explicit and user-correctable
- [ ] Ambiguity ("maybe first week of Dec?") triggers a private clarification, not a guess

**F6. Deterministic date solver**
- [ ] Computes overlapping windows across all submitted availability, weighted by attendance count
- [ ] Surfaces the top 3 windows with "who's in / who's out" for each
- [ ] Never uses the LLM for the interval math
- [ ] Handles partial availability (arriving late / leaving early)

**F7. Decision objects with deadlines**
- [ ] Agent (or admin) can open a decision with options, deadline, and silence rule
- [ ] Members vote from chat or Trip Brain panel in one tap
- [ ] Deadline auto-closes the decision, announces the result with rationale, and updates Trip Brain
- [ ] Hard-constraint violations are blocked from being locked, with an explanation
- [ ] Admin override is possible and logged

**F8. Destination proposals — the hero moment**
Given locked (or leading) dates and collected constraints, Scout returns **3 options with commentary**.
- [ ] Each option states: rough per-head cost, travel time from the modal departure city, why it fits, **and who it fits worst**
- [ ] Options respect every hard constraint; violating options are never shown
- [ ] Each option is immediately votable (becomes a Decision)
- [ ] Regeneration with a nudge ("cheaper", "less travel", "more nature") is one tap

**F9. Chaser nudges + digest**
- [ ] Private nudge at 48h of silence; escalation at 96h; ghost flag to admin
- [ ] T-24h deadline reminder to non-voters only
- [ ] Email digest at each milestone (dates locked, destination locked) — not daily spam

**F10. Trip Brain panel**
- [ ] Always visible beside chat (drawer on mobile), reflecting live state
- [ ] Sections: Party · Dates · Budget · Destination · Decisions · Open items
- [ ] Every item editable; every item shows provenance on tap
- [ ] Shareable read-only snapshot image/link to paste into WhatsApp

### P1 — Should have (fast follows)

- **F11. Itinerary generation** — day-by-day from locked destination, editable, with pace preference honoured
- **F12. Idea inbox** — paste an Instagram/YouTube/blog link, agent extracts the place and files it as a candidate activity with a vote count
- **F13. Prep checklist** — per-person tasks (ID, passport, meds, tickets) with deadlines and completion tracking
- **F14. Booking tracker** — not booking, just *tracking*: who has booked what, with deadlines and reminders
- **F15. Cost estimator** — per-head range for a locked plan, flagged against the private budget ceiling ("this pushes 2 people over their limit")
- **F16. WhatsApp bridge (outbound)** — one-tap generated summary card designed to be pasted into the existing group

### P2 — Future / architectural insurance

- **F17. Treasurer + settle-up** (or BillBreak integration)
- **F18. WhatsApp Cloud API bot** — the app's agents reachable inside the group's existing WhatsApp, which may be the real product
- **F19. Sub-groups** — the 4 people driving vs the 3 flying
- **F20. Post-trip artifacts** — recap, photo pool, "plan next one" with prefs carried over
- **F21. Recurring group memory** — the same friend group's second trip starts 80% pre-filled

Design v1 so F17–F21 are not architecturally blocked: keep members portable across trips, keep money out of the core schema but leave a hook, keep the chat lane abstract enough that WhatsApp becomes a second transport rather than a rewrite.

---

## 10. Identity & Access Model

The no-login requirement is a real security tradeoff. Be deliberate about it.

| Actor | Auth | Powers |
|---|---|---|
| **Admin** | Google OAuth (Supabase Auth) | Create/delete trip, remove members, override locks, close room |
| **Member** | Invite code + name + email → signed JWT in httpOnly cookie | Post, vote, edit own facts, private lane |
| **Returning member** | Cookie, or emailed magic re-entry link | Same |

**Accepted risk:** anyone with the link can join as anyone. For a friend group this is fine, the same way a Jackbox room is fine. Mitigations: admin can close joining after everyone is in; admin sees a join log; duplicate-name warning; email uniqueness per trip; no destructive powers for members (can't delete others' data, can't lock decisions).

**Escalation path if it becomes a problem:** email OTP on first join only — one extra step, still no password, still no account.

---

## 11. Data Model (initial cut)

```
trips              id, name, admin_user_id, invite_code, status, created_at, joining_open
members            id, trip_id, display_name, email, role, status(active|ghost|removed), device_token_hash
messages           id, trip_id, lane(group|private:member_id), author_type(member|agent),
                   author_id, agent_name, body, metadata jsonb, created_at
facts              id, trip_id, member_id, category, type(HARD|SOFT), value jsonb,
                   confidence, source_message_id, source(intake|extract|manual), superseded_by
availability       id, trip_id, member_id, start_date, end_date, strength(free|partial|blocked)
decisions          id, trip_id, type, state, options jsonb, quorum_rule, deadline,
                   default_on_silence, locked_option, rationale, locked_by
votes              id, decision_id, member_id, option_id, is_veto, created_at
trip_brain         trip_id, snapshot jsonb, version   -- materialised; rebuildable from facts
agent_runs         id, trip_id, agent, trigger, input_tokens, output_tokens, cost, latency, outcome
tasks              id, trip_id, member_id, title, due_at, done_at        -- P1
```

`trip_brain` is a materialised projection, not a source of truth. Everything is rebuildable from `facts` + `availability` + `decisions`. That property is what lets you change the LLM, the prompts, or the extraction logic without corrupting existing trips.

---

## 12. Tech Stack & Architecture Decision

### 12.1 The actual question: Next.js alone, or Next.js + Python?

**Verdict: Next.js + TypeScript end-to-end for v1. Do not add a Python service.**

Reasoning:
- The agent work here is **orchestration-heavy, not ML-heavy**. Tool-calling loops, structured output with Zod, scheduled jobs, and a state machine. TypeScript does all of this well now.
- Solo side projects die from two-repo overhead — two deploys, two dependency trees, two sets of types, one context switch too many. This is the single biggest predictor of a stalled side project.
- Vercel's serverless timeout is the one real objection, and it's solved by moving agent runs to a **durable execution layer** rather than by moving to Python.

**When to add Python later:** if you need LangGraph's checkpoint/interrupt model for genuinely complex multi-agent graphs with human-in-the-loop pauses, or a real eval harness over prompts. Both are v2 concerns, and LangGraph.js exists if you want the same model in TS. Keep the agent layer behind a clean interface so swapping the runtime is a contained change.

### 12.2 Recommended stack

| Layer | Choice | Why |
|---|---|---|
| **Framework** | Next.js 15 (App Router), TypeScript | One codebase for UI + API routes + server actions |
| **UI** | Tailwind v4 + shadcn/ui | Matches your existing workflow; fast to a real design |
| **DB + Realtime** | Supabase (Postgres, Realtime, RLS, Storage) | You already know it; Realtime handles chat without a socket server |
| **Auth** | Supabase Auth (admin only) + custom signed JWT for members | Matches the no-login requirement |
| **LLM calls** | Vercel AI SDK v5 (streaming, tool-calling, structured output) | Provider-agnostic; swap models per task |
| **Models** | Gemini 2.5 Flash for extraction/gating; a stronger model (Claude Sonnet / Gemini Pro) for Scout & Planner | Cost-routed by task, not one model everywhere |
| **Durable agent runs** | Inngest (or Trigger.dev) | Cron nudges, retries, fan-out, long runs — the piece Next.js alone lacks |
| **Web research** | Tavily or Brave Search API, with aggressive per-destination caching | Scout needs current prices/seasonality |
| **Email** | Resend | Digests, re-entry links, nudges |
| **Analytics** | PostHog | Funnel: link opened → joined → intake completed → voted |
| **Hosting** | Vercel + Supabase + Inngest Cloud | All generous free tiers |

**Alternative if you dislike Inngest:** a small Node worker on Railway/Fly with BullMQ + Redis. More control, more ops. Not worth it for v1.

### 12.3 Request flow

```
member types → POST /api/messages → insert row → Supabase Realtime broadcasts to room
                                  ↓
                        Inngest event "message.created"
                                  ↓
            debounce 30s / 10 messages → cheap gate model
                                  ↓ (only if constraint-bearing)
                    Scribe → structured facts → upsert facts + trip_brain
                                  ↓
               state change events → Concierge decides: act or stay quiet
                                  ↓
                    agent posts message + receipt → Realtime
```

Cron (Inngest scheduled): Chaser sweeps open decisions and silent members every hour.

### 12.4 LLM cost control (matters on a side project budget)

1. **Gate before you extract.** A one-line Flash classifier on batched messages; most banter never reaches a real extraction call.
2. **Debounce aggressively.** Never one LLM call per message.
3. **Feed structured state, not transcripts.** Agents read Trip Brain (a few hundred tokens), not the last 200 messages. Only Scribe sees raw text, and only a small window of it.
4. **Cache destination research** by `(destination, month, party_size_band)` — shared across all trips.
5. **Log every run** in `agent_runs` with cost. Know your cost-per-trip by week 2, not month 6.
6. **Hard cap per trip** with graceful degradation ("I'll summarise instead of researching") rather than a silent failure.

---

## 13. Success Metrics

**Leading (days–weeks)**
| Metric | Target | Stretch |
|---|---|---|
| Invite link → joined | 65% | 80% |
| Joined → intake completed within 24h | 60% | 75% |
| Trip creation → dates locked | <72h median | <24h |
| Organiser share of total human messages | <30% | <20% |
| Decisions closed by deadline without manual chasing | 70% | 85% |
| Agent correction rate (facts edited by members) | <15% | <8% |

**Lagging (weeks–months)**
| Metric | Target |
|---|---|
| Trips reaching locked dates + destination | 40% of created trips |
| Trips that actually happen (self-reported) | 25% |
| Organiser creates a second trip | 30% |
| Groups that report moving decisions off WhatsApp | 40% |

**The one metric that matters most:** *organiser message share*. If the organiser is still sending half the messages, the agents aren't doing their job and the product has failed regardless of how good the destination suggestions are.

---

## 14. Risks

| # | Risk | Severity | Mitigation |
|---|---|---|---|
| R1 | **WhatsApp gravity** — the group won't move | Critical | Don't compete for banter. Position as the decision surface. Ship the paste-into-WhatsApp summary card early. Treat the WhatsApp Cloud API bot (F18) as a live strategic option, not a far-future nice-to-have. |
| R2 | **Cold start silence** — nobody fills anything in | High | Tap-first private intake, 90 seconds, no blank text box. Nudges. Admin can enter facts on someone's behalf. |
| R3 | **Sterility** — feels like homework vs. a fun chat | High | Agent personality, fast animations, the hero destination moment within minutes of joining |
| R4 | **Wrong extraction erodes trust** | High | Provenance on every fact, one-tap correction, private clarification on low confidence, corrections permanently outrank the model |
| R5 | **LLM cost per trip** | Medium | Gating, debouncing, structured context, caching, per-trip cap |
| R6 | **Identity spoofing** | Medium | Accepted for friend groups; admin join log + close-room + optional email OTP escalation |
| R7 | **Scope creep into booking** | Medium | Explicit non-goal. Bookings are a separate product with separate economics. |
| R8 | **Agent spam** | Medium | Never-two-in-a-row rule, digest instead of per-event pings |

---

## 15. Open Questions

**Blocking (answer before building)**
- **[Product]** Is the group lane a real-time chat, or an asynchronous message board? Real-time invites WhatsApp comparison you will lose. A slower, structured surface may be strategically better.
- **[Product]** Should destination proposals come *before* dates lock? Showing 3 tempting options early may be the hook that drives participation, even if the constraints are incomplete.
- **[Engineering]** Materialised `trip_brain` vs. computing on read. Start materialised with rebuild-from-events, or start computed and optimise later?
- **[Product]** Does the admin need to be special at all after creation, or can the room be flat with the agent as the only authority?

**Non-blocking (resolve during build)**
- **[Design]** Mobile layout: how does the Trip Brain panel coexist with chat on a 380px screen? Drawer, tab, or pinned card?
- **[Product]** Default silence rule per decision type — is "silence = flexible" right for dates but wrong for budget?
- **[Engineering]** Vote weighting: does a member who submitted zero constraints get the same vote weight as one who filled everything in?
- **[Product]** Trip lifecycle end — when does a room go read-only, and what happens to it after?
- **[Legal]** Storing emails of people who never consented to an account; keep a delete-my-data path from day one.

---

## 16. Build Order

Each phase ends in something demoable. Do not start the next until the current one is real.

**Phase 1 — Skeleton (1–2 weeks)**
Trip creation, invite code, no-login join, group chat with Realtime, member list. No AI at all.
*Demo:* 5 people on 5 phones talking in a room joined from a link.

**Phase 2 — The Brain (1–2 weeks)**
Trip Brain panel, facts schema, tap-first private intake, deterministic date solver, manual decision objects with deadlines and voting.
*Demo:* a group converges on dates with zero AI. **If this phase isn't useful on its own, the AI won't save it.**

**Phase 3 — Agents (2–3 weeks)**
Scribe extraction with provenance and receipts, Concierge routing, Chaser cron and nudges, Scout's 3-options-with-commentary.
*Demo:* the hero moment — link sent, six people drop constraints, three destination options with real tradeoffs appear.

**Phase 4 — Depth (2–3 weeks)**
Planner itinerary, idea inbox, prep checklist, booking tracker, email digests, WhatsApp summary card.

**Phase 5 — Beta (2 weeks)**
Ship to 5 real friend groups planning real trips. Instrument the funnel. Watch where people stop typing. Expect the intake questions to be wrong and the nudge timing to be wrong.

---

## 17. Design Notes

- **Aesthetic:** warm and social, not enterprise SaaS. This competes with a group chat, which feels like friends, not Jira.
- **Speed of first value:** the join screen → intake → a visible change in the Trip Brain should all happen inside a minute. The member must see that their input *moved something*.
- **Agent voice:** short, decisive, occasionally funny. "Dates locked: Nov 12–15. Karan's out for the first night, joining Thursday. Next up: where." Never a paragraph. Never an apology. Never "Great question!"
- **The shareable artifact** (Trip Brain snapshot card) is a distribution feature, not a convenience feature. It's how the app gets into WhatsApp groups it wasn't invited to.

---

## 18. Addendum — Decisions Resolved (v0.2)

Section 15's blocking questions are now answered. These supersede the open questions above.

**D1. The group lane is an asynchronous structured board, not a real-time chat.**
No typing indicators, no read receipts, no race to reply. Messages land as cards in a feed. This is a deliberate refusal to compete with WhatsApp on its own terms — the surface reads as a decision log, not a conversation.

**D2. Destination proposals come after discussion, not before.**
Scout does not fire on a timer or on join. It fires when the group has actually talked — vibe, places people threw out, constraints, and above all **budget**. The sequence mirrors how a real group chat works: "let's go somewhere" → people argue about vibe and places → *then* someone proposes options. Proposals generated from thin constraints are the failure mode to avoid; the agent should say "I need budgets from 3 more people before I can suggest anything real."

**D3. Materialised `trip_brain` with rebuild-from-events, and the projection improves every iteration.**
Source of truth stays in `facts` / `availability` / `decisions`. The projection is versioned and rebuildable, so extraction logic can improve and every existing trip gets the benefit on the next rebuild.

**D4. Admin keeps real powers.** Not a flat room. Admin can: set the trip's vibe and agent tone at creation, gate the start, lock/unlock joining, override any decision, nudge on the agent's behalf, remove members, and act as the escalation target when someone goes silent.

**D5. Trip lifecycle has an explicit locked-lobby phase.**
Create → configure vibe and tone → invite → **room locked while people join** → admin taps **"Start the trip"** → agent posts the kickoff message → everything begins. Nobody can post before the start. This solves the cold-start problem: the trip begins as an event, not a slow trickle, and everyone arrives at the same moment.

**D6. Silence never auto-decides. It escalates.**
Replaces the earlier "silence = flexible" rule. Ladder: **T+24h** private agent nudge → **T+48h** second nudge with a one-tap "I'm flexible, decide without me" → **T+72h** agent flags the member to the admin for a human follow-up. The agent never assumes consent on someone's behalf. Admin can then mark them flexible, mark them out, or chase them personally.

**D7. Every member's vote weighs the same.** Participation is not earned influence. A member who filled in nothing still gets a full vote — but gets nudged (D6) and flagged to the admin. Voting power is never used as a participation lever.

**D8. Threads.** Slack/Discord-style threads live inside the group lane, but **a thread is visible only to its participants**. This replaces the separate "private lane" concept with one unified mechanic: the agent's 1:1 intake is simply a thread with one member; a side conversation between three people about driving is a thread with three. Budget and sensitive constraints are entered in a thread and never surfaced to the group except as aggregates.

**D9. Mobile-first, not mobile-responsive.** The design is drawn at 390×844 first and scaled up to desktop, not the reverse. Modern mobile patterns throughout: bottom tab navigation, bottom sheets over modals, sticky composer, thumb-zone primary actions, 44px minimum targets.
