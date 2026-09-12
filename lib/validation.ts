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
