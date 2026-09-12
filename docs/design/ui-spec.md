# Caravan — Mobile UI Design Spec (v1, F1–F16)

Drawn at **390 × 844** (iPhone 15 base). Safe areas: 44 top, 34 bottom. Minimum touch target 44 × 44.

---

## 1. Design Direction

**Warm, social, and quietly structured.** This app sits next to WhatsApp in someone's browser — if it feels like Jira, nobody opens it twice. But it is also the serious surface where decisions get locked, so it can't be all confetti.

The resolution: **warm paper-toned surfaces with a decisive, high-contrast accent.** Content is soft and friendly; the moments that matter (deadlines, locks, votes) are sharp and loud. Agent messages get their own visual language — a distinct teal identity, never dressed up as a person, never a chat bubble with a fake avatar.

Tonal references: Partiful's invite energy for the join flow, Linear's structural clarity for the decision surfaces, Airbnb's warmth for destination cards.

---

## 2. Design Tokens

### Color

| Token | Hex | Use |
|---|---|---|
| `surface/0` | `#FFFDF8` | App background (warm white) |
| `surface/1` | `#F6F1E7` | Cards, message bubbles |
| `surface/2` | `#EBE4D6` | Pressed states, dividers, input fills |
| `ink/900` | `#1A1712` | Primary text |
| `ink/700` | `#443E33` | Secondary text |
| `ink/500` | `#756D5D` | Tertiary, metadata, timestamps |
| `ink/300` | `#B4AB99` | Placeholder, disabled |
| `brand/500` | `#E2613C` | Primary actions, terracotta |
| `brand/600` | `#C44A28` | Pressed primary |
| `brand/100` | `#FBE2D8` | Primary tint backgrounds |
| `agent/500` | `#2F8F83` | Agent identity — teal |
| `agent/100` | `#D7ECE8` | Agent message background |
| `warn/500` | `#E09B2D` | Deadline approaching, nudges |
| `warn/100` | `#FBEDD3` | Warning tint |
| `ok/500` | `#3D9B62` | Locked, confirmed, done |
| `ok/100` | `#DBEFE2` | Success tint |
| `stop/500` | `#D14343` | Hard constraints, vetoes, conflicts |
| `stop/100` | `#F9DEDE` | Conflict tint |

Member identity colors: a 6-value rotation (`#E2613C`, `#2F8F83`, `#7A5AC4`, `#D18E2D`, `#C4557F`, `#3E7BC4`) assigned by join order, used on avatars and availability bars.

### Type — Inter

| Style | Size / Line | Weight |
|---|---|---|
| Display | 28 / 34 | Semi Bold |
| H1 | 22 / 28 | Semi Bold |
| H2 | 18 / 24 | Semi Bold |
| Body | 15 / 22 | Regular |
| Body Strong | 15 / 22 | Medium |
| Small | 13 / 18 | Regular |
| Label | 12 / 16 | Medium, +0.2 tracking |
| Code | 20 / 24 | Mono, +4 tracking — room codes only |

### Spacing, radius, elevation

Spacing: `4 · 8 · 12 · 16 · 20 · 24 · 32 · 40`. Screen gutter = 20.
Radius: `8` inputs · `12` cards · `16` message bubbles · `24` bottom sheets · `999` pills.
Elevation: `e1` card `0 1 2 rgba(26,23,18,.06)` · `e2` sheet `0 -4 24 rgba(26,23,18,.12)` · `e3` FAB `0 4 12 rgba(226,97,60,.28)`.

---

## 3. Information Architecture

Three bottom tabs. Everything else is a push or a sheet.

```
┌─────────────────────────────────────────┐
│  ROOM          PLAN            YOU      │
│  the board   trip brain    threads+tasks│
└─────────────────────────────────────────┘
```

- **Room** — the async board. Messages, agent posts, decision cards, thread previews. Badge = unread.
- **Plan** — the Trip Brain. Party, dates, budget, destination, itinerary, open items. Badge = open decisions needing your vote.
- **You** — your threads (including the agent's 1:1), your intake status, your tasks and booking deadlines. Badge = unanswered nudges.

Above the tabs on every screen: a **trip switcher app bar** (trip name + avatar stack + overflow), since one person can be in several trips.

**Why not a drawer for the Trip Brain:** on 390px a side drawer is a cramped afterthought. Promoting it to a peer tab makes the state as important as the chat, which is the whole product thesis.

---

## 4. Component Inventory (build as Figma components with variants)

| Component | Variants |
|---|---|
| `Button` | primary · secondary · ghost · destructive × default/pressed/disabled/loading, sm/md/lg |
| `IconButton` | default · active · badged |
| `Input` | text · email · textarea × default/focus/error/filled |
| `Chip` | selectable · selected · removable · count |
| `Avatar` | xs 20 · sm 28 · md 40 · lg 56, image/initials, with status ring |
| `AvatarStack` | 3 · 5 · overflow count |
| `MessageBubble` | mine · theirs · system × first/middle/last in group |
| `AgentMessage` | receipt · question · proposal · nudge · announcement |
| `DecisionCard` | open · voting · closing-soon · locked · vetoed |
| `OptionRow` | unselected · selected · winning · eliminated, with vote avatars |
| `DestinationCard` | collapsed · expanded, with fit/misfit commentary |
| `FactRow` | stated · extracted (with confidence dot) · conflicted · editable |
| `AvailabilityBar` | per-member horizontal date strip, free/partial/blocked |
| `DateWindowCard` | ranked window with who's-in/out |
| `ThreadPreview` | participant avatars · reply count · last message |
| `Composer` | collapsed · expanded · with attachment tray |
| `BottomSheet` | grabber · title · content · sticky footer action |
| `TabBar` | 3 tabs, badge states |
| `AppBar` | title · back · trip switcher · overflow |
| `CountdownPill` | >24h · <24h (warn) · expired |
| `ProgressDots` | intake step indicator |
| `EmptyState` | illustration slot · headline · body · action |
| `ToastReceipt` | undo affordance |
| `MemberRow` | active · silent · nudged · flagged · ghost, with admin actions |

---

## 5. Screen Inventory — F1 to F16

35 frames across 7 flows.

### Flow A — Admin setup (F1)
| # | Screen | Notes |
|---|---|---|
| A1 | Landing | For anyone hitting the root URL without an invite |
| A2 | Admin sign-in | Google only, one button |
| A3 | My trips | Multiple trips, each with status and pending-action count |
| A4 | Create — basics | Trip name, rough intent, optional trip length |
| A5 | Create — vibe & tone | Admin presets the vibe chips, budget hint, and the **agent's tone** (chill / efficient / funny) |
| A6 | Create — invite | Room code in mono, share link, WhatsApp share button, QR |
| A7 | Lobby (admin) | Live join list, "Start the trip" primary CTA, lock/unlock joining |

### Flow B — Member join (F2)
| # | Screen | Notes |
|---|---|---|
| B1 | Invite landing | Trip name, who created it, "6 already joined" avatar stack, big Join button |
| B2 | Join form | Name + email only. One screen, autofocus, keyboard-aware CTA |
| B3 | Lobby (member) | "Waiting for Amit to start" + who else is here + edit your name |

### Flow C — Intake, in a 1:1 thread (F4)
| # | Screen | Notes |
|---|---|---|
| C1 | Intake intro | "5 questions, 90 seconds" + progress dots |
| C2 | Availability | Month calendar, tap-drag ranges, free/partial/blocked tri-state |
| C3 | Budget | Slider with bands, explicit **"only the group ceiling is shared"** lock badge |
| C4 | Departure city | Search + recent suggestions |
| C5 | Vibe | Multi-select chip grid, 12 chips |
| C6 | Hard nos | Chips + free text, everything marked HARD |
| C7 | Done | "You're in" + what happens next |

### Flow D — The Room (F3, F5, F12)
| # | Screen | Notes |
|---|---|---|
| D1 | Room — kickoff | Agent's opening message right after admin starts. Empty but alive. |
| D2 | Room — active | Mixed human messages, agent receipts, a live decision card, thread previews |
| D3 | Composer expanded | Text, paste-a-link (idea inbox), propose a decision, start a thread |
| D4 | Thread view | Participants-only. Header shows exactly who can see it. |
| D5 | Agent message gallery | All five agent message variants side by side (spec page, not a route) |

### Flow E — Plan / Trip Brain (F10)
| # | Screen | Notes |
|---|---|---|
| E1 | Plan overview | Party · Dates · Budget · Destination · Open items, each a summary card |
| E2 | Fact detail sheet | Provenance ("from Rhea's message, Tue 4:12pm"), confidence, edit, mark hard/soft |
| E3 | Party sheet | Member statuses, per-member intake completeness, nudge + admin actions |
| E4 | Share snapshot | The paste-into-WhatsApp card, with a preview of exactly what gets copied |

### Flow F — Decisions (F6, F7, F8)
| # | Screen | Notes |
|---|---|---|
| F1s | Date windows | Top 3 overlapping windows, per-member availability bars, who's in/out |
| F2s | Decision card (inline) | Lives in the Room feed — options, countdown, vote inline |
| F3s | Decision detail | Full screen: options, who voted what, deadline, admin override |
| F4s | Destination proposals | **The hero.** 3 cards, each with cost/travel/why-it-fits/who-it-fits-worst |
| F5s | Destination detail | Expanded option, per-member fit breakdown, "regenerate cheaper/closer/wilder" |
| F6s | Decision locked | Announcement state, what unlocked next, admin can reopen |
| F7s | Conflict state | A hard constraint blocks the leading option — what the agent says and offers |

### Flow G — Depth (F11, F13, F14, F15, F16)
| # | Screen | Notes |
|---|---|---|
| G1 | Itinerary — day view | Day tabs, timeline, drag to reorder, per-stop votes |
| G2 | Idea inbox | Pasted links parsed into place cards, vote to promote into the itinerary |
| G3 | Prep checklist | Your tasks vs. group tasks, deadlines, completion ring |
| G4 | Booking tracker | Who has booked what, per-person status, nudge button |
| G5 | Cost estimator | Per-head range, the "2 people go over budget" warning band |
| G6 | Admin controls | Overrides, reopen decision, remove member, close room |
| G7 | Nudge & digest states | Nudge card, escalation-to-admin card, email digest layout |

---

## 6. Key Mobile Patterns

- **Bottom sheets over modals** for everything editable — fact detail, budget, member actions. Grabber, drag-to-dismiss, sticky primary action in the thumb zone.
- **Sticky composer** pinned above the tab bar, collapses to a single line, expands over the feed with an attachment tray.
- **Decision cards are inline, votable in one tap** — never "open a screen to vote". The detail screen exists for depth, not for the primary action.
- **Countdown is always visible** on any live decision — a pill in the card header that turns amber under 24h.
- **Receipts, not walls of text.** Every agent state change is a single line with an undo chip, not a paragraph.
- **Keyboard-aware CTAs** — join and composer buttons ride above the keyboard, never hidden behind it.
- **Empty states do work.** Every empty state names the one thing the person should do next, with a button that does it.
- **Thread privacy is shown, not assumed** — every thread header states plainly who can see it. This is a trust surface; ambiguity here kills the feature.
