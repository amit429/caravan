import { generateObject, NoObjectGeneratedError } from "ai";
import { z } from "zod";
import { flashModel, estimateCost, fastGoogleOptions } from "./runtime/model";
import { logAgentRun } from "./runtime/log-run";
import { postAgentMessage } from "./runtime/post-agent-message";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { extractIdeaMetadata } from "@/lib/ideas/extract-idea";
import { extractAccommodationDetails } from "@/lib/accommodations/extract-accommodation";
import { refreshDatesDecisionIfStale } from "@/lib/decisions/refresh-dates-decision";
import type { DecisionRow, MemberRow, MessageRow } from "@/lib/database.types";

const MODEL_ID = "gemini-3.6-flash";
const CONFIDENCE_THRESHOLD = 0.7;

const gateSchema = z.object({ containsExtractableInfo: z.boolean() });

async function passesGate(tripId: string, messageBody: string): Promise<boolean> {
  const start = Date.now();
  try {
    const { object, usage } = await generateObject({
      model: flashModel,
      schema: gateSchema,
      prompt: `Does this message contain a travel constraint, date/availability mention, budget mention, destination preference, an activity/place proposal or link, or a hard "I can't"/"no" statement? Message: "${messageBody}"`,
      providerOptions: fastGoogleOptions,
    });
    await logAgentRun({
      tripId,
      agent: "scribe",
      trigger: "message.gate",
      inputTokens: usage.inputTokens ?? 0,
      outputTokens: usage.outputTokens ?? 0,
      cost: estimateCost(MODEL_ID, usage.inputTokens ?? 0, usage.outputTokens ?? 0),
      latencyMs: Date.now() - start,
      outcome: "success",
    });
    return object.containsExtractableInfo;
  } catch (error) {
    await logAgentRun({
      tripId,
      agent: "scribe",
      trigger: "message.gate",
      inputTokens: 0,
      outputTokens: 0,
      cost: 0,
      latencyMs: Date.now() - start,
      outcome: "error",
      errorMessage: String(error),
    });
    return false; // fail closed: don't extract if the gate itself errors
  }
}

const extractionItemSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("fact"),
    memberId: z.string(),
    category: z.enum(["budget", "departure_city", "vibe", "hard_no"]),
    type: z.enum(["HARD", "SOFT"]),
    value: z.record(z.string(), z.unknown()),
    confidence: z.number().min(0).max(1),
    rationale: z.string(),
  }),
  z.object({
    kind: z.literal("availability"),
    memberId: z.string(),
    startDate: z.string(),
    endDate: z.string(),
    strength: z.enum(["free", "partial", "blocked"]),
    confidence: z.number().min(0).max(1),
    rationale: z.string(),
  }),
  z.object({
    kind: z.literal("idea"),
    memberId: z.string(),
    category: z.enum(["activity", "stay", "travel"]),
    title: z.string(),
    note: z.string().optional(),
    url: z.string().optional(),
    confidence: z.number().min(0).max(1),
    rationale: z.string(),
  }),
]);

// Live-observed failure modes for this exact schema (agent_runs on the trip
// this was built for, an "I don't have budget more than 70k" message that
// failed extraction — and stayed failed — twice, even with the retry's own
// repair-prompt echoing the error back): the model reliably nails the
// *content* but is flaky about this schema's exact shape in several
// different, non-overlapping ways run to run — "value" JSON-stringified
// instead of nested, a fact's HARD/SOFT field renamed to "strength" (bleeding
// over from availability's own field) or "constraint_type", snake_case keys
// ("member_id"), and sometimes "memberId" dropped entirely. A stronger prompt
// alone didn't fix it (same mistake survived the repair retry unprompted) —
// this normalizes the raw JSON before Zod ever sees it, so generation
// doesn't have to be perfect for extraction to succeed. authorMemberId is
// the one piece of real context to default a missing memberId to — always
// correct here, since a single Scribe call only ever extracts what one known
// author said about themselves (runScribe's own filter already assumes this).
export function normalizeExtractionItem(item: unknown, authorMemberId: string): unknown {
  if (typeof item !== "object" || item === null) return item;
  const snakeToCamel = (key: string) => key.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
  const obj: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(item as Record<string, unknown>)) {
    obj[snakeToCamel(key)] = value;
  }

  if (obj.memberId === undefined) obj.memberId = authorMemberId;

  if (obj.kind === "fact") {
    if (obj.type === undefined && typeof obj.strength === "string") obj.type = obj.strength;
    if (obj.type === undefined && typeof obj.constraintType === "string") obj.type = obj.constraintType;
    if (typeof obj.type === "string") obj.type = obj.type.toUpperCase();
    if (typeof obj.value === "string") {
      try {
        obj.value = JSON.parse(obj.value);
      } catch {
        // leave as-is — fails validation with a clear error either way
      }
    }
  }
  return obj;
}

function buildScribeOutputSchema(authorMemberId: string) {
  return z.object({
    extractions: z.preprocess(
      (val) => (Array.isArray(val) ? val.map((item) => normalizeExtractionItem(item, authorMemberId)) : val),
      z.array(extractionItemSchema)
    ),
  });
}

// The bug this fixes: "2nd march", "before 1st march" etc. have no year and
// no reference point in the raw message text — buildScribePrompt used to
// hand the model nothing but the message itself, so it either hallucinated
// or refused to produce a valid ISO date, and generateObject threw
// AI_NoObjectGeneratedError on every one of them (silently swallowed below).
// This anchors "now" to a real year the trip has already established
// (whatever's already in availability, if anything) and surfaces the
// group's actual proposed date window(s) so a relative ask like "can we
// finish a day earlier" resolves against something real instead of guessing.
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

async function buildDateContext(
  tripId: string,
  supabase: ReturnType<typeof createServiceSupabaseClient>
): Promise<string> {
  const today = new Date().toISOString().slice(0, 10);
  let anchorYear: number | null = null;
  let anchorMonth: number | null = null; // 1-12
  let leadingWindows: string[] = [];

  try {
    // The earliest-filed row, not the most recent — this is meant to capture
    // the month the trip was originally anchored to (from intake or the
    // first chat mention), which a later ambiguous message ("27th to 5th",
    // no month given) should resolve against. The literal bug this fixes:
    // that exact message got extracted as Sep-Oct (the nearest future "27th"
    // from today) instead of the trip's real Feb/Mar window, because only a
    // year was ever given as context, never a month.
    const { data: earliestAvailability } = await supabase
      .from("availability")
      .select("start_date")
      .eq("trip_id", tripId)
      .order("created_at", { ascending: true })
      .limit(1);
    const firstRow = earliestAvailability?.[0] as { start_date: string } | undefined;
    if (firstRow) {
      anchorYear = Number(firstRow.start_date.slice(0, 4));
      anchorMonth = Number(firstRow.start_date.slice(5, 7));
    }
  } catch {
    // Best-effort context only — a failed lookup here should never block
    // extraction, it just means the model falls back to "nearest future date."
  }

  try {
    const { data: datesDecisions } = await supabase
      .from("decisions")
      .select("options")
      .eq("trip_id", tripId)
      .eq("type", "DATES")
      .order("created_at", { ascending: false })
      .limit(1);
    const latest = datesDecisions?.[0] as Pick<DecisionRow, "options"> | undefined;
    if (latest) leadingWindows = latest.options.map((o) => o.label);
  } catch {
    // Same as above — proceed without it.
  }

  const lines = [`Today's date is ${today}.`];
  if (anchorYear && anchorMonth) {
    lines.push(
      `This trip's other members have already shared dates around ${MONTH_NAMES[anchorMonth - 1]} ${anchorYear} — use that exact month and year for any date mentioned without one (e.g. "the 27th" or "27th to 5th" means the 27th of ${MONTH_NAMES[anchorMonth - 1]}, running into the following month if the end day is smaller than the start day), unless the message clearly states a different month or year. Do not default to the nearest calendar occurrence from today's date — the trip's own established month always wins.`
    );
  } else {
    lines.push(`No year or month has been established for this trip yet — assume the nearest sensible future occurrence of any date mentioned.`);
  }
  if (leadingWindows.length > 0) {
    lines.push(
      `The group's current proposed date option(s): ${leadingWindows.join(", ")}. Resolve relative requests ("before X", "a day earlier", "can we skip the last night") against these into concrete startDate/endDate values.`
    );
  }
  return lines.join(" ");
}

function buildScribePrompt(member: MemberRow, body: string, dateContext: string): string {
  return `You are extracting structured trip-planning facts from one chat message. Only extract what this specific person (memberId "${member.id}", name "${member.display_name}") is saying about themselves — never invent facts, never guess at other people. If the message contains nothing extractable, return an empty extractions array.

${dateContext}

Message: "${body}"

Rules:
- A firm "I can't" / "no" statement is HARD. A preference ("I'd like", "maybe") is SOFT.
- Only use category "budget", "departure_city", "vibe", or "hard_no" for kind "fact".
- For category "budget", value must be {"amount": <integer, INR per head>} — convert anything vague ("around 15k", "fifteen thousand") to a plain number, never a range or band. "k" means thousand (70k = 70000); "L"/"lakh"/"lac" means one hundred thousand (1.5L = 150000, 2 lac = 200000).
- Extract kind "availability" whenever the message states or clearly implies specific dates — including relative asks ("before the 1st", "can we finish a day earlier"). startDate/endDate must be real YYYY-MM-DD values, resolved using the date context above. Never emit a placeholder or partial date.
- Extract kind "idea" only for an actual proposal or a link — "let's go scuba diving", "we should check out X", or any URL. A vague vibe comment ("I like beaches") is NOT an idea — leave it out entirely. category: "stay" for hotel/accommodation links or suggestions, "travel" for flight/train/bus links or timing/schedule info, "activity" for everything else (things to do, food, nightlife, general suggestions). If the message contains a URL, put it verbatim in "url". The place/activity name goes in a field called exactly "title" — never "label" or "name".
- confidence is 0-1. If you're not confident, say so with a lower number rather than guessing.
- rationale is a short (under 12 words) human-readable summary for a receipt message, e.g. "Karan can't travel Nov 20-25 (hard)".`;
}

// One corrective retry before giving up — cheap insurance against a single
// malformed generation, not a fix for a model that's fundamentally
// confused. Distinct from generateObject's own maxRetries, which only
// retries transient request failures, never a schema-validation failure
// (NoObjectGeneratedError) — the actual failure mode this trip's agent_runs
// showed on repeat.
//
// Verified against the live trip this was built for: a generic "double-check
// your dates" reminder wasn't enough — the model's actual mistake was
// structural, not the dates themselves (e.g. inventing an "isSoft" boolean
// instead of the schema's "strength" enum, or a bare string where "value"
// needs an object). NoObjectGeneratedError carries the model's own raw
// output (`.text`) and Zod's exact complaint (`String(error)`) — echoing
// both back is a far stronger repair signal than a generic nudge, since the
// model is now correcting its own literal mistake instead of guessing what
// might be wrong.
async function extractWithRetry(prompt: string, authorMemberId: string) {
  const schema = buildScribeOutputSchema(authorMemberId);
  try {
    return await generateObject({ model: flashModel, schema, providerOptions: fastGoogleOptions, prompt });
  } catch (error) {
    const raw = NoObjectGeneratedError.isInstance(error) ? error.text : undefined;
    const repairPrompt = raw
      ? `${prompt}\n\nYour previous attempt produced this, which does not match the required schema:\n${raw}\n\nValidation errors: ${String(error)}\n\nFix it: match every field name and type in the schema exactly (e.g. "strength" must be one of "free"/"partial"/"blocked", not an "isSoft" boolean; a "fact"'s "value" must be an object, never a bare string). Return corrected, complete JSON.`
      : `${prompt}\n\nYour previous attempt at this didn't produce valid output. Double-check: every "startDate"/"endDate" must be a real YYYY-MM-DD value (never a placeholder, never partial), and every field the schema requires must be present.`;
    return await generateObject({ model: flashModel, schema, providerOptions: fastGoogleOptions, prompt: repairPrompt });
  }
}

// "posted" means Scribe put a message on the board somewhere — a filed
// receipt, a dedupe note, or its own honest "couldn't parse that" fallback.
// Callers that need a reply guarantee (the You thread) check this, not
// whether a DB row landed — a message that already got an answer must never
// get a second, unrelated one stacked on top of it.
type ScribeResult = { posted: boolean };

// The whole extraction pipeline for one new group message (spec F5, §8.1
// message-events trigger, simplified to per-message since batching needs a
// queue we haven't added yet). Never throws — a broken extraction should
// never take down the message-post request that triggered it.
export async function runScribe(params: {
  tripId: string;
  message: MessageRow;
  authorMember: MemberRow;
  threadId?: string;
}): Promise<ScribeResult> {
  const passed = await passesGate(params.tripId, params.message.body);
  if (!passed) return { posted: false };

  const supabase = createServiceSupabaseClient();
  const dateContext = await buildDateContext(params.tripId, supabase);
  const prompt = buildScribePrompt(params.authorMember, params.message.body, dateContext);

  const start = Date.now();
  let result: Awaited<ReturnType<typeof extractWithRetry>>;
  try {
    result = await extractWithRetry(prompt, params.authorMember.id);
  } catch (error) {
    if (process.env.SCRIBE_DEBUG) console.log("[scribe debug] extraction failed after retry:", error);
    await logAgentRun({
      tripId: params.tripId,
      agent: "scribe",
      trigger: "message.extract",
      inputTokens: 0,
      outputTokens: 0,
      cost: 0,
      latencyMs: Date.now() - start,
      outcome: "error",
      errorMessage: String(error),
    });
    // Never silent: the member said something the gate flagged as real, but
    // extraction still couldn't resolve it after a retry — say so instead of
    // leaving them wondering whether the message did anything at all.
    await postAgentMessage({
      tripId: params.tripId,
      agentName: "scribe",
      body: "Got that, but couldn't pin down the specifics — mind rephrasing with an exact date or detail?",
      metadata: { sourceMessageId: params.message.id },
      threadId: params.threadId,
    });
    return { posted: true };
  }

  await logAgentRun({
    tripId: params.tripId,
    agent: "scribe",
    trigger: "message.extract",
    inputTokens: result.usage.inputTokens ?? 0,
    outputTokens: result.usage.outputTokens ?? 0,
    cost: estimateCost(MODEL_ID, result.usage.inputTokens ?? 0, result.usage.outputTokens ?? 0),
    latencyMs: Date.now() - start,
    outcome: "success",
  });

  if (process.env.SCRIBE_DEBUG) console.log("[scribe debug] raw extractions:", JSON.stringify(result.object.extractions, null, 2));

  // Only ever file facts about the message's own author, at or above the
  // confidence floor — low-confidence guesses are skipped, not applied
  // (spec: ambiguity should prompt clarification, never a silent guess).
  const applied = result.object.extractions.filter(
    (item) => item.confidence >= CONFIDENCE_THRESHOLD && item.memberId === params.authorMember.id
  );
  if (applied.length === 0) return { posted: false };

  const receipts: string[] = [];
  let filedAvailability = false;

  for (const item of applied) {
    if (item.kind === "fact") {
      const { data: inserted } = await supabase
        .from("facts")
        .insert({
          trip_id: params.tripId,
          member_id: item.memberId,
          category: item.category,
          type: item.type,
          value: item.value,
          confidence: item.confidence,
          source: "extract",
          source_message_id: params.message.id,
        })
        .select("id")
        .single();

      // Budget and departure city are "what's true right now" answers — a
      // later chat correction should replace the group's picture (an intake
      // resubmission already does this by hard-deleting; a chat mention uses
      // the softer superseded_by link so the old answer stays visible as
      // provenance). Hard-nos and vibe tags are additive signal instead —
      // each new mention adds a constraint/preference, it doesn't retract
      // the last one — so those are left alone.
      if (inserted && (item.category === "budget" || item.category === "departure_city")) {
        await supabase
          .from("facts")
          .update({ superseded_by: inserted.id })
          .eq("trip_id", params.tripId)
          .eq("member_id", item.memberId)
          .eq("category", item.category)
          .is("superseded_by", null)
          .neq("id", inserted.id);
      }
    } else if (item.kind === "availability") {
      await supabase.from("availability").insert({
        trip_id: params.tripId,
        member_id: item.memberId,
        start_date: item.startDate,
        end_date: item.endDate,
        strength: item.strength,
      });
      filedAvailability = true;
    } else if (item.category === "stay") {
      // A stay suggestion gets its own richer home (accommodations), not
      // the general ideas inbox — price and area are what actually matter
      // here, in a way a plain idea card never captures. Same URL-dedupe
      // shape as the general idea path below.
      if (item.url) {
        const { data: existing } = await supabase
          .from("accommodations")
          .select("id")
          .eq("trip_id", params.tripId)
          .eq("url", item.url)
          .maybeSingle();
        if (existing) {
          receipts.push(`already have "${item.title}"`);
          continue;
        }
      }
      const details = await extractAccommodationDetails({ name: item.title, url: item.url });
      await supabase.from("accommodations").insert({
        trip_id: params.tripId,
        member_id: item.memberId,
        name: details.title,
        url: item.url ?? null,
        price: details.price,
        area: details.area,
        image_url: details.imageUrl,
        source: "chat",
      });
    } else {
      // idea (activity, or travel until its own dedicated home ships) —
      // dedupe by exact URL within the trip first so the same link pasted
      // twice (or mentioned once and already filed via the explicit "drop a
      // link" composer) doesn't produce a second card.
      if (item.url) {
        const { data: existingIdea } = await supabase
          .from("ideas")
          .select("id")
          .eq("trip_id", params.tripId)
          .eq("url", item.url)
          .maybeSingle();
        if (existingIdea) {
          receipts.push(`already have "${item.title}"`);
          continue;
        }
        const meta = await extractIdeaMetadata(item.url);
        await supabase.from("ideas").insert({
          trip_id: params.tripId,
          member_id: item.memberId,
          category: item.category,
          url: item.url,
          title: meta.title ?? item.title,
          note: meta.note ?? item.note ?? null,
          image_url: meta.imageUrl,
        });
      } else {
        await supabase.from("ideas").insert({
          trip_id: params.tripId,
          member_id: item.memberId,
          category: item.category,
          url: null,
          title: item.title,
          note: item.note ?? null,
          image_url: null,
        });
      }
    }
    receipts.push(item.rationale);
  }

  await postAgentMessage({
    tripId: params.tripId,
    agentName: "scribe",
    body: `Filed: ${receipts.join(" · ")}`,
    metadata: { sourceMessageId: params.message.id },
    threadId: params.threadId,
  });

  // A new/changed availability row can invalidate an already-OPEN DATES
  // vote's options — best-effort, same as every other cascade in this file;
  // never lets a refresh failure take down the filing that already succeeded.
  if (filedAvailability) {
    try {
      await refreshDatesDecisionIfStale(params.tripId, "availability");
    } catch (error) {
      if (process.env.SCRIBE_DEBUG) console.log("[scribe debug] dates refresh failed:", error);
    }
  }

  return { posted: true };
}
