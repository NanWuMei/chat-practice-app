import type {
  ChatMessage,
  DistilledPersona,
  MentorCard,
  TongReview,
  GottmanReview,
  AriadneScoring,
  DualReviewReport,
  BehaviorMetrics,
} from "../../shared/types";
import { callAIWithRetry } from "./provider";
import { buildTongReviewPrompt, buildGottmanReviewPrompt, buildAriadneScoringPrompt } from "./prompts";
import { parseTongReview, parseGottmanReview, parseAriadneScoring } from "../../shared/validators";

export async function runDualReview(
  messages: ChatMessage[],
  persona: DistilledPersona,
  tongMentor: MentorCard,
  gottmanMentor: MentorCard,
  sessionId: string,
  emotionalBankScore: number = 0,
  behaviorContext?: string,
  behaviorMetrics?: BehaviorMetrics,
): Promise<DualReviewReport> {
  // Step 1: 童锦程
  console.log("🎯 Step 1/3: 童锦程分析中...");
  const tongPrompt = buildTongReviewPrompt(messages, persona, tongMentor);
  const tongRaw = await callAIWithRetry(
    [{ role: "system", content: tongPrompt.system }, { role: "user", content: tongPrompt.user }],
    { temperature: 0.6, maxTokens: 8192 }
  );
  const tongReview = parseTongReview(tongRaw);
  console.log("✅ 童锦程分析完成");

  // Step 2: Gottman
  console.log("🧠 Step 2/3: Gottman 分析中...");
  const gottmanPrompt = buildGottmanReviewPrompt(messages, persona, gottmanMentor, JSON.stringify(tongReview, null, 2), emotionalBankScore, behaviorContext);
  const gottmanRaw = await callAIWithRetry(
    [{ role: "system", content: gottmanPrompt.system }, { role: "user", content: gottmanPrompt.user }],
    { temperature: 0.5, maxTokens: 8192 }
  );
  const gottmanReview = parseGottmanReview(gottmanRaw);
  console.log("✅ Gottman 分析完成");

  // Step 3: Ariadne
  console.log("📊 Step 3/3: Ariadne 评分中...");
  const ariadnePrompt = buildAriadneScoringPrompt(messages, persona, JSON.stringify(tongReview, null, 2), JSON.stringify(gottmanReview, null, 2));
  const ariadneRaw = await callAIWithRetry(
    [{ role: "system", content: ariadnePrompt.system }, { role: "user", content: ariadnePrompt.user }],
    { temperature: 0.4, maxTokens: 8192 }
  );
  const ariadneScoring = parseAriadneScoring(ariadneRaw);
  console.log("✅ Ariadne 评分完成");

  // AI 给出的基础分
  let finalBankScore = gottmanReview.emotionalBankAccount.score;

  // 叠加行为指标扣分/加分
  if (behaviorMetrics) {
    finalBankScore += behaviorMetrics.frequencyDelta;
    finalBankScore -= behaviorMetrics.ghostPenalty;
    if (behaviorMetrics.isShortChat) {
      console.log("⚠️ 短聊惩罚：Gottman 已在评分中额外扣分");
    }
    if (behaviorMetrics.ghostPenalty > 0) {
      console.log("👻 已读不回惩罚：-" + behaviorMetrics.ghostPenalty);
    }
    if (behaviorMetrics.frequencyDelta !== 0) {
      console.log("📅 频率调节：" + (behaviorMetrics.frequencyDelta > 0 ? "+" : "") + behaviorMetrics.frequencyDelta);
    }
    console.log("💳 最终得分：AI " + gottmanReview.emotionalBankAccount.score + " + 行为调节 " + (finalBankScore - gottmanReview.emotionalBankAccount.score) + " = " + finalBankScore);
  }

  return {
    sessionId,
    tongReview,
    gottmanReview,
    ariadneScoring,
    mergedSummary: buildMergedSummary(tongReview, gottmanReview, ariadneScoring),
    createdAt: new Date().toISOString(),
    bankScore: finalBankScore,
    relationshipStage: gottmanReview.emotionalBankAccount.stage,
    stageReason: gottmanReview.emotionalBankAccount.stageReason,
    behaviorMetrics,
  };
}

function buildMergedSummary(tong: TongReview, gottman: GottmanReview, ariadne: AriadneScoring): string {
  const parts: string[] = [ariadne.summary];
  if (gottman.mentorDiscussion.finalConsensus) parts.push(`导师共识：${gottman.mentorDiscussion.finalConsensus}`);
  if (tong.topStrengths[0]) parts.push(`亮点：${tong.topStrengths[0]}`);
  if (tong.topMistakes[0]) parts.push(`待改进：${tong.topMistakes[0]}`);
  parts.push(`下一步：${ariadne.nextGoal}`);
  return parts.join(" | ");
}