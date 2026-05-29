import { Router, type Request, type Response } from "express";
import { randomUUID } from "crypto";
import type { ChatMessage, TrainingSession, SessionSummary, DualReviewReport, DistilledPersona, BehaviorMetrics } from "../shared/types";
import { callAIWithRetry } from "./ai/provider";
import { buildChatPrompt, buildMemoryExtractionPrompt } from "./ai/prompts";
import { parseChatModelResult } from "../shared/validators";
import { runDualReview } from "./ai/review";
import { liangYouan, tongJincheng, gottman } from "./data";
import { seedDefaultData } from "./db";
import * as personaService from "./services/personaService";
import * as sessionService from "./services/sessionService";

const router = Router();

// 情感账户阶段阈值
const STAGE_THRESHOLDS = [
  { stage: "恋人", minScore: 350 },
  { stage: "暧昧期", minScore: 200 },
  { stage: "好朋友", minScore: 100 },
  { stage: "普通朋友", minScore: 30 },
  { stage: "陌生人", minScore: 0 },
];
const TERMINATION_THRESHOLD = -10;

// 初始化数据库并播种默认数据
seedDefaultData([liangYouan]);

// ============================================================
// 辅助
// ============================================================

function addSystemMsg(sessionId: string, content: string): void {
  sessionService.addMessage(sessionId, "system", content);
}

function getSessionNum(personaId: string): number {
  return sessionService.getSessionsByPersona(personaId).length;
}

function computeBehaviorMetrics(
  personaId: string,
  currentSessionId: string,
  currentMessages: ChatMessage[],
): BehaviorMetrics {
  const userTurns = currentMessages.filter((m) => m.role === "user").length;
  const isShortChat = userTurns < 8;

  const personaSessions = sessionService.getSessionsByPersona(personaId)
    .filter((s) => s.id !== currentSessionId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const lastSession = personaSessions[0];
  let daysSinceLastSession: number | null = null;
  let frequencyDelta = 0;
  let ghostPenalty = 0;

  if (lastSession) {
    const lastTime = new Date(lastSession.createdAt).getTime();
    const currentTime = new Date().getTime();
    daysSinceLastSession = Math.floor((currentTime - lastTime) / (1000 * 60 * 60 * 24));

    if (daysSinceLastSession <= 1) {
      frequencyDelta = 3;
    } else if (daysSinceLastSession >= 5) {
      frequencyDelta = -5;
    }

    const lastMessages = sessionService.getMessages(lastSession.id);
    const lastMsg = lastMessages[lastMessages.length - 1];
    if (lastMsg && lastMsg.role === "persona" && lastSession.status === "active") {
      ghostPenalty = 10;
    }
  }

  return {
    turnCount: userTurns,
    isShortChat,
    ghostPenalty,
    ghostFromPrevious: 0,
    frequencyDelta,
    daysSinceLastSession,
  };
}

function formatBehaviorContext(metrics: BehaviorMetrics): string {
  const parts: string[] = [];
  parts.push(`- 本次聊天轮数：${metrics.turnCount}轮${metrics.isShortChat ? "（低于8轮标准，请在评分中体现这种'聊两句就走'的行为）" : ""}`);
  if (metrics.daysSinceLastSession !== null) {
    parts.push(`- 距上次聊天：${metrics.daysSinceLastSession}天`);
    if (metrics.frequencyDelta > 0) parts.push(`  → 频繁聊天，关系维护良好（+${metrics.frequencyDelta}分）`);
    if (metrics.frequencyDelta < 0) parts.push(`  → 长期未来聊天，关系疏远（${metrics.frequencyDelta}分）`);
  } else {
    parts.push("- 这是第一次聊天");
  }
  if (metrics.ghostPenalty > 0) {
    parts.push(`- ⚠️ 已读不回：上次聊天的最后一句是对方发的，用户没有回复就开了新会话（-${metrics.ghostPenalty}分）`);
  }
  return parts.join("\n");
}

// ============================================================
// 结构化长期记忆
// ============================================================

type SessionMemory = {
  sessionNum: number;
  date: string;
  factsAboutUser: string[];
  personaImpression: string;
  keyMoments: string[];
  relationshipState: string;
  bankScore?: number;
  stage?: string;
};

async function extractSessionMemory(
  session: TrainingSession,
  sessionMessages: ChatMessage[],
  reviewData: DualReviewReport | undefined
): Promise<SessionMemory> {
  const chatText = sessionMessages
    .filter((m) => m.role === "user" || m.role === "persona")
    .map((m) => `[${m.role === "user" ? "用户" : "梁友安"}] ${m.content}`)
    .join("\n");

  const prompt = buildMemoryExtractionPrompt(chatText, reviewData?.mergedSummary ?? "");

  try {
    const raw = await callAIWithRetry(
      [{ role: "system", content: prompt.system }, { role: "user", content: prompt.user }],
      { temperature: 0.3, maxTokens: 2048 }
    );

    const parsed = raw as {
      factsAboutUser?: string[];
      personaImpression?: string;
      keyMoments?: string[];
      relationshipState?: string;
    };

    return {
      sessionNum: getSessionNum(session.personaId),
      date: new Date(session.createdAt).toLocaleDateString("zh-CN"),
      factsAboutUser: parsed.factsAboutUser ?? [],
      personaImpression: parsed.personaImpression ?? "",
      keyMoments: parsed.keyMoments ?? [],
      relationshipState: parsed.relationshipState ?? "",
      bankScore: undefined,
      stage: undefined,
    };
  } catch (err) {
    console.warn("记忆提取失败，使用降级方案:", (err as Error).message);
    const userMsgs = sessionMessages.filter((m) => m.role === "user").map((m) => m.content);
    return {
      sessionNum: getSessionNum(session.personaId),
      date: new Date(session.createdAt).toLocaleDateString("zh-CN"),
      factsAboutUser: userMsgs.slice(0, 3),
      personaImpression: "暂无",
      keyMoments: [],
      relationshipState: "未知",
      bankScore: undefined,
      stage: undefined,
    };
  }
}

function buildMemoryContext(personaId: string): string {
  const memories = sessionService.getMemories(personaId);
  if (memories.length === 0) return "";

  const recent = memories.slice(-3);
  const older = memories.slice(0, -3);
  const parts: string[] = [];

  for (const m of recent) {
    parts.push(`### 第${m.sessionNum}次聊天（${m.date}）`);
    if (m.factsAboutUser.length > 0) parts.push(`关于用户：${m.factsAboutUser.join("；")}`);
    if (m.personaImpression) parts.push(`你的印象：${m.personaImpression}`);
    if (m.keyMoments.length > 0) parts.push(`关键时刻：${m.keyMoments.join("；")}`);
    if (m.relationshipState) parts.push(`关系状态：${m.relationshipState}`);
  }

  if (older.length > 0) {
    parts.push("### 更早的聊天");
    for (const m of older) {
      parts.push(`第${m.sessionNum}次（${m.date}）：${m.factsAboutUser.join("；")}`);
    }
  }

  return `\n\n## 你的长期记忆（关于这个用户的历次聊天记录）\n⚠️ 以下是你和这个用户之前聊天的真实记忆。你必须基于这些事实来回应，不要编造不存在的记忆。\n${parts.join("\n")}\n⚠️ 重要：你可以自然地引用这些记忆（比如"上次你说过..."），但不要逐字复述，要像真人一样自然地记得。如果用户提到你不知道的事情，坦诚说不记得。`;
}

// ============================================================
// API 路由
// ============================================================

router.get("/api/personas", (_req: Request, res: Response) => {
  const all = personaService.getAllPersonas().map((p) => ({ ...p, terminated: p.emotionalBankScore < TERMINATION_THRESHOLD }));
  res.json(all);
});

router.get("/api/mentors", (_req: Request, res: Response) => {
  res.json([tongJincheng, gottman]);
});

router.get("/api/personas/:personaId/sessions", (req: Request, res: Response) => {
  const { personaId } = req.params;
  const personaSessions = sessionService.getSessionsByPersona(personaId);

  const summaries: SessionSummary[] = personaSessions.map((s) => {
    const msgs = sessionService.getMessages(s.id);
    const lastMsg = msgs[msgs.length - 1];
    return {
      id: s.id,
      personaId: s.personaId,
      status: s.status,
      turnCount: s.turnCount,
      lastMessage: lastMsg?.content.slice(0, 50) ?? "",
      lastMessageRole: lastMsg?.role,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
      bankScore: s.sessionBankScore,
    };
  });
  res.json(summaries);
});

router.get("/api/sessions/:id", (req: Request, res: Response) => {
  const session = sessionService.getSession(req.params.id!);
  if (!session) { res.status(404).json({ error: "会话不存在" }); return; }
  res.json(session);
});

router.post("/api/sessions", (req: Request, res: Response) => {
  const { personaId } = req.body as { personaId: string };
  const persona = personaService.getPersona(personaId);
  if (!persona) {
    res.status(400).json({ error: "未知的角色 ID" }); return;
  }
  if (persona.emotionalBankScore < TERMINATION_THRESHOLD) {
    res.status(403).json({ error: "RELATIONSHIP_TERMINATED", message: "关系已终止，该角色不愿再与你聊天。可以使用分身重新开始。" }); return;
  }
  const num = getSessionNum(personaId) + 1;
  const session: TrainingSession = {
    id: randomUUID(), personaId,
    goal: "练习与独立职业女性的自然聊天",
    status: "active", currentState: { ...persona.initialState },
    turnCount: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  };
  sessionService.saveSession(session);

  // 检测已读不回：如果该 persona 有 active 的旧会话，且最后一条是 persona 发的
  const existingActiveSessions = sessionService.getSessionsByPersona(personaId)
    .filter((s) => s.status === "active" && s.id !== session.id);
  for (const oldSession of existingActiveSessions) {
    const oldMsgs = sessionService.getMessages(oldSession.id);
    const lastOldMsg = oldMsgs[oldMsgs.length - 1];
    if (lastOldMsg && lastOldMsg.role === "persona") {
      persona.emotionalBankScore -= 10;
      oldSession.status = "reviewed";
      oldSession.updatedAt = new Date().toISOString();
      addSystemMsg(oldSession.id, "你没有回复对方的消息就离开了。对方感到被忽视。");
      sessionService.saveSession(oldSession);
      personaService.savePersona(persona);
      console.log(`👻 已读不回检测：扣分 -10，累积 ${persona.emotionalBankScore}`);
    }
  }

  addSystemMsg(session.id, `开始第${num}次聊天`);
  sessionService.saveSession(session);
  res.json(session);
});

router.post("/api/sessions/:id/messages", async (req: Request, res: Response) => {
  const { id } = req.params;
  const { content } = req.body as { content: string };
  const session = sessionService.getSession(id!);
  if (!session) { res.status(404).json({ error: "会话不存在" }); return; }
  if (session.status === "reviewed") { res.status(400).json({ error: "该会话已结束" }); return; }

  // 添加用户消息
  const userMessage = sessionService.addMessage(id!, "user", content);

  // 构建聊天历史
  const sessionMessages = sessionService.getMessages(id!);
  const chatHistory = sessionMessages
    .filter((m) => m.role === "user" || m.role === "persona")
    .map((m) => ({ role: m.role === "user" ? "user" as const : "assistant" as const, content: m.content }));

  // 加载长期记忆
  const memoryContext = buildMemoryContext(session.personaId);

  try {
    const persona = personaService.getPersona(session.personaId) ?? liangYouan;
    const { system, messages: msgs } = buildChatPrompt(persona, chatHistory, persona.emotionalBankScore);
    const fullSystem = system + memoryContext;

    const raw = await callAIWithRetry(
      [{ role: "system", content: fullSystem }, ...msgs],
      { temperature: 0.8, maxTokens: 1024 }
    );
    const result = parseChatModelResult(raw);

    for (const key of Object.keys(result.state_delta) as Array<keyof typeof result.state_delta>) {
      session.currentState[key] = Math.max(0, Math.min(100, session.currentState[key] + result.state_delta[key]));
    }

    const personaMessage = sessionService.addMessage(id!, "persona", result.reply);
    session.turnCount += 1;
    session.updatedAt = new Date().toISOString();

    sessionService.saveSession(session);

    res.json({
      userMessage,
      message: personaMessage,
      stateReason: result.state_reason,
      boundaryFlags: result.boundary_flags,
    });
  } catch (err) {
    console.error("AI 调用失败:", err);
    res.status(500).json({ error: "AI 回复失败，请重试", detail: err instanceof Error ? err.message : String(err) });
  }
});

router.get("/api/sessions/:id/messages", (req: Request, res: Response) => {
  const session = sessionService.getSession(req.params.id!);
  if (!session) { res.status(404).json({ error: "会话不存在" }); return; }
  const sessionMessages = sessionService.getMessages(req.params.id!);
  res.json(sessionMessages);
});

router.post("/api/sessions/:id/review", async (req: Request, res: Response) => {
  const { id } = req.params;
  const session = sessionService.getSession(id!);
  if (!session) { res.status(404).json({ error: "会话不存在" }); return; }

  const sessionMessages = sessionService.getMessages(id!);
  const chatMsgs = sessionMessages.filter((m) => m.role === "user" || m.role === "persona");
  if (chatMsgs.length < 2) { res.status(400).json({ error: "聊天太少，无法复盘" }); return; }

  try {
    console.log(`\n🔄 开始三导师复盘（${chatMsgs.length} 条消息）`);
    const persona = personaService.getPersona(session.personaId) ?? liangYouan;

    // 计算行为指标
    const behaviorMetrics = computeBehaviorMetrics(session.personaId, id!, sessionMessages);
    const behaviorContext = formatBehaviorContext(behaviorMetrics);
    console.log(`📋 行为指标：${behaviorMetrics.turnCount}轮，频率调节${behaviorMetrics.frequencyDelta >= 0 ? "+" : ""}${behaviorMetrics.frequencyDelta}，已读不回-${behaviorMetrics.ghostPenalty}`);

    const report = await runDualReview(chatMsgs, persona, tongJincheng, gottman, id!, persona.emotionalBankScore, behaviorContext, behaviorMetrics);
    session.status = "reviewed";
    session.updatedAt = new Date().toISOString();

    // 累积情感账户分数
    persona.emotionalBankScore += report.bankScore;
    session.sessionBankScore = report.bankScore;
    console.log("情感账户：本轮 " + (report.bankScore >= 0 ? "+" : "") + report.bankScore + "，累积 " + persona.emotionalBankScore + "（" + report.relationshipStage + "）");

    // 检查关系终止
    if (persona.emotionalBankScore < TERMINATION_THRESHOLD) {
      addSystemMsg(id!, "关系已终止。该角色不愿再与你聊天。可以使用分身重新开始。");
    }

    addSystemMsg(id!, "复盘完成");

    // 保存到存储
    sessionService.saveReview(id!, report);
    sessionService.saveSession(session);
    personaService.savePersona(persona);

    // 提取结构化记忆
    console.log("🧠 提取长期记忆...");
    const memory = await extractSessionMemory(session, sessionMessages, report);
    sessionService.saveMemory(session.personaId, memory);
    console.log(`✅ 记忆提取完成（${memory.factsAboutUser.length} 条事实）`);

    res.json(report);
  } catch (err) {
    console.error("复盘失败:", err);
    res.status(500).json({ error: "复盘生成失败，请重试", detail: err instanceof Error ? err.message : String(err) });
  }
});

router.get("/api/sessions/:id/review", (req: Request, res: Response) => {
  const review = sessionService.getReview(req.params.id!);
  if (!review) { res.status(404).json({ error: "该会话还没有复盘" }); return; }
  res.json(review);
});

// 删除会话（永久删除）
router.delete("/api/sessions/:id", (req: Request, res: Response) => {
  const { id } = req.params;
  const session = sessionService.getSession(id!);
  if (!session) { res.status(404).json({ error: "会话不存在" }); return; }

  // Reverse emotional bank score if session was reviewed
  const persona = personaService.getPersona(session.personaId);
  let scoreChanged = false;
  if (persona && session.sessionBankScore) {
    persona.emotionalBankScore -= session.sessionBankScore;
    scoreChanged = true;
    console.log("Score reversed: " + (session.sessionBankScore >= 0 ? "-" : "+") + Math.abs(session.sessionBankScore) + ", total: " + persona.emotionalBankScore);
  }

  // Restore ghost penalty if this session triggered one
  if (persona) {
    const laterSessions = sessionService.getSessionsByPersona(session.personaId)
      .filter((s) => s.id !== id && new Date(s.createdAt).getTime() > new Date(session.createdAt).getTime());
    for (const laterSession of laterSessions) {
      const laterMsgs = sessionService.getMessages(laterSession.id);
      const hasGhostMsg = laterMsgs.some((m) => m.role === "system" && m.content.includes("没有回复对方的消息"));
      if (hasGhostMsg) {
        persona.emotionalBankScore += 10;
        scoreChanged = true;
        console.log("Ghost penalty restored: +10, total: " + persona.emotionalBankScore);
        break;
      }
    }
  }

  // Delete from DB (cascading deletes handle messages, reviews, memories)
  sessionService.deleteSession(id!);

  if (persona && scoreChanged) {
    personaService.savePersona(persona);
  }
  console.log("会话已删除：" + id);
  res.json({ success: true });
});

// 删除分身（只能删除分身，不能删除原版）
router.delete("/api/personas/:id", (req: Request, res: Response) => {
  const { id } = req.params;
  if (!id.includes("-clone-")) { res.status(400).json({ error: "不能删除原版角色" }); return; }
  const persona = personaService.getPersona(id);
  if (!persona) { res.status(404).json({ error: "角色不存在" }); return; }

  // Delete persona (cascading deletes handle sessions, messages, reviews, memories)
  personaService.deletePersona(id);

  console.log("分身已删除：" + id);
  res.json({ success: true });
});

// 分身：复制角色，重置情感账户分数
router.post("/api/personas/:id/clone", (req: Request, res: Response) => {
  const { id } = req.params;
  const clone = personaService.clonePersona(id);
  if (!clone) { res.status(404).json({ error: "角色不存在" }); return; }
  console.log("分身创建：" + clone.id);
  res.json(clone);
});

export default router;
