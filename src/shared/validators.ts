import { z } from "zod";
import type { ChatModelResult, ReviewModelResult } from "./types";

const metricDeltaSchema = z.object({
  comfort: z.number().int().min(-10).max(10),
  trust: z.number().int().min(-10).max(10),
  interest: z.number().int().min(-10).max(10),
  ambiguity: z.number().int().min(-10).max(10),
  pressure: z.number().int().min(-10).max(10)
});

const scoreSchema = z.object({
  start: z.number().int().min(0).max(100),
  end: z.number().int().min(0).max(100),
  reason: z.string().min(1)
});

const chatModelResultSchema = z.object({
  reply: z.string().trim().min(1),
  state_delta: metricDeltaSchema,
  state_reason: z.string().trim().min(1),
  boundary_flags: z.array(z.string().trim().min(1))
});

const reviewModelResultSchema = z.object({
  summary: z.string().trim().min(1),
  scores: z.object({
    comfort: scoreSchema,
    trust: scoreSchema,
    interest: scoreSchema,
    ambiguity: scoreSchema,
    pressure: scoreSchema
  }),
  turning_points: z.array(
    z.object({
      user_message: z.string().trim().min(1),
      impact: z.string().trim().min(1),
      why: z.string().trim().min(1)
    })
  ).min(1).max(4),
  better_versions: z.array(
    z.object({
      original: z.string().trim().min(1),
      better: z.string().trim().min(1),
      why: z.string().trim().min(1)
    })
  ).min(1).max(4),
  next_goal: z.string().trim().min(1)
});

export function parseChatModelResult(input: unknown): ChatModelResult {
  return chatModelResultSchema.parse(input);
}

export function parseReviewModelResult(input: unknown): ReviewModelResult {
  return reviewModelResultSchema.parse(input);
}
