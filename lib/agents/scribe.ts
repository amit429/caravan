import { generateObject } from "ai";
import { z } from "zod";
import { flashModel, estimateCost, fastGoogleOptions } from "./model";
import { logAgentRun } from "./log-run";
import { postAgentMessage } from "./post-agent-message";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import type { MemberRow, MessageRow } from "@/lib/database.types";

const MODEL_ID = "gemini-2.5-flash";
const CONFIDENCE_THRESHOLD = 0.7;

const gateSchema = z.object({ containsExtractableInfo: z.boolean() });

async function passesGate(tripId: string, messageBody: string): Promise<boolean> {
  const start = Date.now();
  try {
    const { object, usage } = await generateObject({
      model: flashModel,
      schema: gateSchema,
      prompt: `Does this message contain a travel constraint, date/availability mention, budget mention, destination preference, or a hard "I can't"/"no" statement? Message: "${messageBody}"`,
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
]);

const scribeOutputSchema = z.object({ extractions: z.array(extractionItemSchema) });

function buildScribePrompt(member: MemberRow, body: string): string {
  return `You are extracting structured trip-planning facts from one chat message. Only extract what this specific person (memberId "${member.id}", name "${member.display_name}") is saying about themselves — never invent facts, never guess at other people. If the message contains no extractable constraint, dates, budget, or preference, return an empty extractions array.

Message: "${body}"

Rules:
- A firm "I can't" / "no" statement is HARD. A preference ("I'd like", "maybe") is SOFT.
- Only use category "budget", "departure_city", "vibe", or "hard_no" for facts.
- Only extract availability (kind: "availability") when the message states specific or clearly-implied dates.
- confidence is 0-1. If you're not confident, say so with a lower number rather than guessing.
- rationale is a short (under 12 words) human-readable summary for a receipt message, e.g. "Karan can't travel Nov 20-25 (hard)".`;
}

// The whole extraction pipeline for one new group message (spec F5, §8.1
// message-events trigger, simplified to per-message since batching needs a
// queue we haven't added yet). Never throws — a broken extraction should
// never take down the message-post request that triggered it.
export async function runScribe(params: { tripId: string; message: MessageRow; authorMember: MemberRow }) {
  const passed = await passesGate(params.tripId, params.message.body);
  if (!passed) return;

  const start = Date.now();
  let result: Awaited<ReturnType<typeof generateObject<typeof scribeOutputSchema>>>;
  try {
    result = await generateObject({
      model: flashModel,
      schema: scribeOutputSchema,
      providerOptions: fastGoogleOptions,
      prompt: buildScribePrompt(params.authorMember, params.message.body),
    });
  } catch (error) {
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
    return;
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

  // Only ever file facts about the message's own author, at or above the
  // confidence floor — low-confidence guesses are skipped, not applied
  // (spec: ambiguity should prompt clarification, never a silent guess).
  const applied = result.object.extractions.filter(
    (item) => item.confidence >= CONFIDENCE_THRESHOLD && item.memberId === params.authorMember.id
  );
  if (applied.length === 0) return;

  const supabase = createServiceSupabaseClient();
  const receipts: string[] = [];

  for (const item of applied) {
    if (item.kind === "fact") {
      await supabase.from("facts").insert({
        trip_id: params.tripId,
        member_id: item.memberId,
        category: item.category,
        type: item.type,
        value: item.value,
        confidence: item.confidence,
        source: "extract",
        source_message_id: params.message.id,
      });
    } else {
      await supabase.from("availability").insert({
        trip_id: params.tripId,
        member_id: item.memberId,
        start_date: item.startDate,
        end_date: item.endDate,
        strength: item.strength,
      });
    }
    receipts.push(item.rationale);
  }

  await postAgentMessage({
    tripId: params.tripId,
    agentName: "scribe",
    body: `Filed: ${receipts.join(" · ")}`,
    metadata: { sourceMessageId: params.message.id },
  });
}
