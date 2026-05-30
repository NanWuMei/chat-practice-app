import { z } from 'zod';
import type {
  ChatModelResult,
  HintResult,
  M2Output,
} from './types';

// ============================================================
// 聊天模型输出校验
// ============================================================

const chatModelResultSchema = z.object({
  reply: z.string().trim().min(1),
});

// ============================================================
// 提示
// ============================================================

const hintResultSchema = z.object({
  hints: z.array(z.string().trim().min(1)).min(1).max(3),
});

// ============================================================
// M2：苏格拉底提问输出
// ============================================================

const m2QuestionSchema = z.object({
  km_id: z.number().int().min(1),
  question: z.string().trim().min(1),
});

const m2OutputSchema = z.object({
  questions: z.array(m2QuestionSchema).min(1),
});

// ============================================================
// M4：模式发现聚合问题（纯字符串，无结构化JSON）
// ============================================================

// M4聚合问题只需要原始字符串，不需要schema验证

// ============================================================
// 导出解析函数
// ============================================================

export function parseChatModelResult(input: unknown): ChatModelResult {
  return chatModelResultSchema.parse(input);
}

export function parseHintResult(input: unknown): HintResult {
  return hintResultSchema.parse(input);
}

export function parseM2Output(input: unknown): M2Output {
  return m2OutputSchema.parse(input);
}
