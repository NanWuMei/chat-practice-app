import { z } from "zod";
import type {
  ChatModelResult,
  HintResult,
  TongReview,
  GottmanReview,
  AriadneScoring,
  DualReviewReport,
} from "./types";

// ============================================================
// 聊天模型输出
// ============================================================

const metricDeltaSchema = z.object({
  comfort: z.number().int().min(-10).max(10),
  trust: z.number().int().min(-10).max(10),
  interest: z.number().int().min(-10).max(10),
  ambiguity: z.number().int().min(-10).max(10),
  pressure: z.number().int().min(-10).max(10),
});

const chatModelResultSchema = z.object({
  reply: z.string().trim().min(1),
  state_delta: metricDeltaSchema,
  state_reason: z.string().trim().min(1),
  boundary_flags: z.array(z.string().trim().min(1)),
});

// ============================================================
// 提示
// ============================================================

const hintResultSchema = z.object({
  hints: z.array(z.string().trim().min(1)).min(1).max(3),
});

// ============================================================
// 童锦程复盘
// ============================================================

const messageReviewSchema = z.object({
  userMessage: z.string().trim().min(1),
  rating: z.enum(["good", "neutral", "poor"]),
  analysis: z.string().trim().min(1),
  betterVersion: z.preprocess(v => (typeof v === "string" && v.trim() === "") ? undefined : v, z.string().trim().min(1).optional()),
  whyBetter: z.preprocess(v => (typeof v === "string" && v.trim() === "") ? undefined : v, z.string().trim().min(1).optional()),
  keyPoint: z.string().trim().min(1).optional(),
});

const tongReviewSchema = z.object({
  overallAssessment: z.string().trim().min(1),
  messageReviews: z.array(messageReviewSchema).min(1),
  topMistakes: z.array(z.string().trim().min(1)).max(5),
  topStrengths: z.array(z.string().trim().min(1)).max(5),
});

// ============================================================
// Gottman 复盘
// ============================================================

const gottmanPatternSchema = z.object({
  pattern: z.string().trim().min(1),
  description: z.string().trim().min(1),
  severity: z.enum(["positive", "neutral", "warning", "critical"]),
});

const gottmanReviewSchema = z.object({
  relationshipStage: z.string().trim().min(1),
  attachmentSignals: z.array(z.string().trim().min(1)),
  fourHorsemenCheck: z.object({
    criticism: z.boolean(),
    contempt: z.boolean(),
    defensiveness: z.boolean(),
    stonewalling: z.boolean(),
    details: z.array(z.string().trim().min(1)),
  }),
  emotionalBankAccount: z.object({
    deposits: z.array(z.string().trim().min(1)),
    withdrawals: z.array(z.string().trim().min(1)),
    balance: z.enum(["positive", "neutral", "negative"]),
    score: z.number().int(),
    stage: z.string().trim().min(1),
    stageReason: z.string().trim().min(1),
  }),
  patterns: z.array(gottmanPatternSchema),
  mentorDiscussion: z.object({
    discussionPoints: z.array(z.object({
      topic: z.string().trim().min(1),
      tongPosition: z.string().trim().min(1),
      gottmanPosition: z.string().trim().min(1),
      agreed: z.boolean(),
      reasoning: z.string().trim().min(1),
    })).min(1),
    finalConsensus: z.string().trim().min(1),
  }),
});

// ============================================================
// Ariadne 评分
// ============================================================

const ariadneScoreSchema = z.object({
  dimension: z.string().trim().min(1),
  start: z.number().int().min(0).max(100),
  end: z.number().int().min(0).max(100),
  delta: z.number().int(),
  reason: z.string().trim().min(1),
});

const ariadneScoringSchema = z.object({
  summary: z.string().trim().min(1),
  scores: z.array(ariadneScoreSchema).min(3),
  coreNeeds: z.array(z.string().trim().min(1)),
  cognitivePatterns: z.array(z.string().trim().min(1)),
  turningPoints: z
    .array(z.object({ message: z.string().trim().min(1), impact: z.string().trim().min(1), why: z.string().trim().min(1) }))
    .min(1)
    .max(4),
  nextGoal: z.string().trim().min(1),
});

// ============================================================
// 合并复盘报告
// ============================================================

const dualReviewReportSchema = z.object({
  sessionId: z.string().trim().min(1),
  tongReview: tongReviewSchema,
  gottmanReview: gottmanReviewSchema,
  ariadneScoring: ariadneScoringSchema,
  mergedSummary: z.string().trim().min(1),
  createdAt: z.string().trim().min(1),
  bankScore: z.number().int(),
  relationshipStage: z.string().trim().min(1),
  stageReason: z.string().trim().min(1),
});

// ============================================================
// 导出解析函数
// ============================================================

export function parseChatModelResult(input: unknown): ChatModelResult {
  return chatModelResultSchema.parse(input);
}

export function parseHintResult(input: unknown): HintResult {
  return hintResultSchema.parse(input);
}

export function parseTongReview(input: unknown): TongReview {
  return tongReviewSchema.parse(input);
}

export function parseGottmanReview(input: unknown): GottmanReview {
  return gottmanReviewSchema.parse(input);
}

export function parseAriadneScoring(input: unknown): AriadneScoring {
  return ariadneScoringSchema.parse(input);
}

export function parseDualReviewReport(input: unknown): DualReviewReport {
  return dualReviewReportSchema.parse(input);
}