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

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD");

export const intakeSchema = z.object({
  availability: z
    .array(
      z.object({
        startDate: isoDate,
        endDate: isoDate,
        strength: z.enum(["free", "partial", "blocked"]),
      })
    )
    .min(1)
    .max(20),
  budgetBand: z.string().trim().min(1).max(40),
  departureCity: z.string().trim().min(1).max(80),
  vibe: z.array(z.string().trim().min(1).max(40)).max(12).default([]),
  hardNos: z.array(z.string().trim().min(1).max(80)).max(20).default([]),
});
export type IntakeInput = z.infer<typeof intakeSchema>;

export const createDecisionSchema = z.object({
  type: z.enum(["DATES", "DESTINATION", "BUDGET", "STAY", "ACTIVITY", "CUSTOM"]),
  options: z
    .array(z.object({ id: z.string().trim().min(1).max(40), label: z.string().trim().min(1).max(120) }))
    .min(2)
    .max(6),
  quorumRule: z.string().trim().min(1).max(40).default("simple_majority"),
  deadline: z.string().datetime().optional(),
  defaultOnSilence: z.enum(["none", "flexible", "leading_option"]).default("none"),
});
export type CreateDecisionInput = z.infer<typeof createDecisionSchema>;

export const voteSchema = z.object({
  optionId: z.string().trim().min(1).max(40),
  isVeto: z.boolean().optional().default(false),
});
export type VoteInput = z.infer<typeof voteSchema>;

export const closeDecisionSchema = z.object({
  optionId: z.string().trim().min(1).max(40).optional(),
  override: z.boolean().optional().default(false),
});
export type CloseDecisionInput = z.infer<typeof closeDecisionSchema>;

export const createIdeaSchema = z.object({
  url: z.string().trim().url().max(2000),
});
export type CreateIdeaInput = z.infer<typeof createIdeaSchema>;

export const createBookingSchema = z.object({
  item: z.string().trim().min(1).max(80),
  deadline: isoDate.optional(),
});
export type CreateBookingInput = z.infer<typeof createBookingSchema>;

export const bookingStatusSchema = z.object({
  memberId: z.string().trim().min(1).max(80).optional(),
  booked: z.boolean(),
});
export type BookingStatusInput = z.infer<typeof bookingStatusSchema>;

export const taskStatusSchema = z.object({
  done: z.boolean(),
});
export type TaskStatusInput = z.infer<typeof taskStatusSchema>;

export const threadMessageSchema = z.object({
  body: z.string().trim().min(1).max(2000),
});
export type ThreadMessageInput = z.infer<typeof threadMessageSchema>;
