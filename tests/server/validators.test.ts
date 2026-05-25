import { describe, expect, it } from "vitest";
import { parseChatModelResult, parseReviewModelResult } from "../../src/shared/validators";

describe("AI output validators", () => {
  it("parses a valid chat model result", () => {
    const result = parseChatModelResult({
      reply: "刚下班，有点累，但还行。",
      state_delta: { comfort: 2, trust: 1, interest: 0, ambiguity: 0, pressure: -1 },
      state_reason: "用户先接住了疲惫情绪，没有急着推进。",
      boundary_flags: []
    });

    expect(result.reply).toContain("刚下班");
    expect(result.state_delta.comfort).toBe(2);
  });

  it("rejects an empty visible reply", () => {
    expect(() =>
      parseChatModelResult({
        reply: "",
        state_delta: { comfort: 0, trust: 0, interest: 0, ambiguity: 0, pressure: 0 },
        state_reason: "空回复不可展示",
        boundary_flags: []
      })
    ).toThrow();
  });

  it("parses a valid review result", () => {
    const result = parseReviewModelResult({
      summary: "她愿意继续聊，但暧昧基础还不够。",
      scores: {
        comfort: { start: 50, end: 56, reason: "回应更轻松。" },
        trust: { start: 40, end: 43, reason: "有少量自我分享。" },
        interest: { start: 45, end: 47, reason: "话题变得具体。" },
        ambiguity: { start: 20, end: 21, reason: "没有明显推进。" },
        pressure: { start: 15, end: 14, reason: "没有逼问。" }
      },
      turning_points: [{ user_message: "那你今天应该挺累吧", impact: "升温", why: "接住了情绪。" }],
      better_versions: [{ original: "在干嘛", better: "我刚收工，你今天也挺忙吧？", why: "先分享自己。" }],
      next_goal: "下次继续围绕她的工作压力轻松展开。"
    });

    expect(result.scores.comfort.end).toBe(56);
    expect(result.next_goal).toContain("下次");
  });
});
