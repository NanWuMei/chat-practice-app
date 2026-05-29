import { describe, expect, it } from "vitest";
import {
  parseChatModelResult, parseHintResult, parseTongReview,
  parseGottmanReview, parseAriadneScoring,
} from "../../src/shared/validators";

describe("AI 输出验证器", () => {
  describe("聊天模型输出", () => {
    it("解析合法的聊天回复", () => {
      const result = parseChatModelResult({
        reply: "刚下班，有点累，不过还行。",
        state_delta: { comfort: 2, trust: 1, interest: 0, ambiguity: 0, pressure: -1 },
        state_reason: "用户先接住了疲惫情绪，没有急着推进。",
        boundary_flags: [],
      });
      expect(result.reply).toContain("刚下班");
      expect(result.state_delta.comfort).toBe(2);
    });

    it("拒绝空回复", () => {
      expect(() =>
        parseChatModelResult({ reply: "", state_delta: { comfort: 0, trust: 0, interest: 0, ambiguity: 0, pressure: 0 }, state_reason: "空", boundary_flags: [] })
      ).toThrow();
    });

    it("拒绝超出范围的 delta", () => {
      expect(() =>
        parseChatModelResult({ reply: "hi", state_delta: { comfort: 99, trust: 0, interest: 0, ambiguity: 0, pressure: 0 }, state_reason: "x", boundary_flags: [] })
      ).toThrow();
    });
  });

  describe("童锦程复盘", () => {
    it("解析合法的复盘", () => {
      const result = parseTongReview({
        overallAssessment: "整体还行，但有几个明显的失误。",
        messageReviews: [{ userMessage: "在干嘛", rating: "poor", analysis: "太像查户口。", betterVersion: "我刚收工，今天特别累。你呢？", whyBetter: "先分享自己。" }],
        topMistakes: ["查户口式提问"],
        topStrengths: ["接住了她的情绪"],
      });
      expect(result.messageReviews).toHaveLength(1);
      expect(result.messageReviews[0]?.rating).toBe("poor");
    });

    it("拒绝空点评数组", () => {
      expect(() => parseTongReview({ overallAssessment: "还行", messageReviews: [], topMistakes: [], topStrengths: [] })).toThrow();
    });
  });

  describe("Gottman 复盘", () => {
    it("解析合法的复盘", () => {
      const result = parseGottmanReview({
        relationshipStage: "初步熟悉阶段",
        attachmentSignals: ["回复比较克制"],
        fourHorsemenCheck: { criticism: false, contempt: false, defensiveness: false, stonewalling: false, details: [] },
        emotionalBankAccount: { deposits: ["接住了情绪"], withdrawals: ["连续追问"], balance: "neutral", score: 5, stage: "普通朋友", stageReason: "初次互动，有基本的舒适感" },
        patterns: [{ pattern: "情感 bids", description: "用户成功接住", severity: "positive" }],
        mentorDiscussion: { discussionPoints: [{ topic: "提问方式", tongPosition: "像查户口", gottmanPosition: "确实像查户口，缺乏舒适感", agreed: true, reasoning: "初次互动应先建立舒适感" }], finalConsensus: "先建立舒适感" },
      });
      expect(result.fourHorsemenCheck.criticism).toBe(false);
      expect(result.emotionalBankAccount.score).toBe(5);
      expect(result.emotionalBankAccount.stage).toBe("普通朋友");
    });

    it("拒绝缺少 score 字段", () => {
      expect(() => parseGottmanReview({
        relationshipStage: "初步熟悉阶段",
        attachmentSignals: ["回复比较克制"],
        fourHorsemenCheck: { criticism: false, contempt: false, defensiveness: false, stonewalling: false, details: [] },
        emotionalBankAccount: { deposits: [], withdrawals: [], balance: "neutral", stage: "陌生人", stageReason: "初次" },
        patterns: [],
        mentorDiscussion: { discussionPoints: [{ topic: "整体互动", tongPosition: "暂无特别建议", gottmanPosition: "暂无特别分析", agreed: true, reasoning: "信息不足" }], finalConsensus: "暂无" },
      })).toThrow();
    });

    it("解析负分情感账户", () => {
      const result = parseGottmanReview({
        relationshipStage: "关系紧张",
        attachmentSignals: ["回避型信号"],
        fourHorsemenCheck: { criticism: true, contempt: false, defensiveness: false, stonewalling: false, details: ["直接批评对方"] },
        emotionalBankAccount: { deposits: [], withdrawals: ["批评", "不耐烦"], balance: "negative", score: -12, stage: "陌生人", stageReason: "负面互动过多" },
        patterns: [{ pattern: "批评循环", description: "用户频繁批评", severity: "warning" }],
        mentorDiscussion: { discussionPoints: [{ topic: "沟通方式", tongPosition: "继续保持乐观", gottmanPosition: "过于乐观忽略了负面信号", agreed: false, reasoning: "童锦程认为积极态度重要，Gottman认为需要正视问题" }], finalConsensus: "需要改善沟通方式" },
      });
      expect(result.emotionalBankAccount.score).toBe(-12);
      expect(result.emotionalBankAccount.balance).toBe("negative");
    });
  });

  describe("Ariadne 评分", () => {
    it("解析合法的评分", () => {
      const result = parseAriadneScoring({
        summary: "关系有轻微进展。",
        scores: [
          { dimension: "comfort", start: 45, end: 52, delta: 7, reason: "回应更轻松。" },
          { dimension: "trust", start: 35, end: 38, delta: 3, reason: "有自我分享。" },
          { dimension: "interest", start: 40, end: 42, delta: 2, reason: "话题具体。" },
        ],
        coreNeeds: ["被理解"],
        cognitivePatterns: ["倾向提问"],
        turningPoints: [{ message: "那你挺累吧", impact: "正面", why: "接住情绪。" }],
        nextGoal: "围绕工作压力展开。",
      });
      expect(result.scores).toHaveLength(3);
      expect(result.nextGoal).toContain("工作");
    });

    it("拒绝评分数量不足", () => {
      expect(() =>
        parseAriadneScoring({ summary: "x", scores: [{ dimension: "a", start: 1, end: 2, delta: 1, reason: "x" }], coreNeeds: [], cognitivePatterns: [], turningPoints: [{ message: "x", impact: "x", why: "x" }], nextGoal: "x" })
      ).toThrow();
    });
  });

  describe("提示输出", () => {
    it("解析合法提示", () => {
      const result = parseHintResult({ hints: ["先接住疲惫。", "分享自己。"] });
      expect(result.hints).toHaveLength(2);
    });

    it("拒绝空数组", () => {
      expect(() => parseHintResult({ hints: [] })).toThrow();
    });
  });
});