import type { ChatMessage, DistilledPersona, MentorCard } from "../../shared/types";
import * as fs from "fs";
import * as path from "path";

// ============================================================
// Skill 文件加载器
// ============================================================

const SKILLS_DIR = path.join(process.cwd(), "skills");

export function loadSkill(skillRelativePath: string): string {
  const fullPath = path.join(SKILLS_DIR, skillRelativePath);
  try {
    return fs.readFileSync(fullPath, "utf-8");
  } catch (err) {
    console.warn(`Failed to load skill: ${fullPath}`, err);
    return "";
  }
}

function formatMessages(messages: ChatMessage[]): string {
  return messages
    .map((m) => `[${m.role === "user" ? "用户" : "对方"}] ${m.content}`)
    .join("\n");
}

// ============================================================
// 童锦程 Prompt — 实战派话术点评
// ============================================================

export function buildTongReviewPrompt(
  messages: ChatMessage[],
  persona: DistilledPersona,
  mentor: MentorCard
): { system: string; user: string } {
  const skillContent = loadSkill("tong-jincheng-skill-main/SKILL.md");
  
  const system = skillContent || `你是${mentor.name}，一位实战派恋爱聊天导师。

## 核心理念
${mentor.corePhilosophy}

## 思维框架
${mentor.mentalModels.map((m: string) => `- ${m}`).join("\n")}

## 表达风格
${mentor.expressionDna.map((e: string) => `- ${e}`).join("\n")}

## 绝对不会
${mentor.antiPatterns.map((a: string) => `- ${a}`).join("\n")}`;

  const taskPrompt = `

## 任务
逐条分析用户在聊天中的每一句话，给出实战级的话术指导。

## 输出要求
返回 JSON 格式：
{
  "overallAssessment": "整体评价",
  "messageReviews": [
    {
      "userMessage": "用户原话",
      "rating": "good|neutral|poor",
      "analysis": "点评",
      "betterVersion": "更好的说法（仅 poor 必填）",
      "whyBetter": "为什么更好（仅 poor 必填）",
      "keyPoint": "对方信号（如有）"
    }
  ],
  "topMistakes": ["最大错误 2-3 条"],
  "topStrengths": ["最大亮点 2-3 条"]
}

注意：只分析用户消息，rating=poor 必须给 betterVersion，分析要具体接地气。`;

  const user = `## 聊天对象
${persona.background}
性格：${persona.personality.join("、")}
聊天风格：${persona.chatStyle.join("、")}

## 聊天记录
${formatMessages(messages)}

请逐条分析用户的消息。`;

  return { system: system + taskPrompt, user };
}

// ============================================================
// Gottman Prompt — 心理学底层分析
// ============================================================

export function buildGottmanReviewPrompt(
  messages: ChatMessage[],
  persona: DistilledPersona,
  mentor: MentorCard,
  tongReviewJson: string,
  emotionalBankScore: number,
  behaviorContext?: string,
): { system: string; user: string } {
  const skillContent = loadSkill("gottman/gottman.skill.md");
  
  const baseSystem = skillContent || `你是${mentor.name}，一位基于实证研究的关系心理学家。

## 核心理念
${mentor.corePhilosophy}

## 分析框架
${mentor.mentalModels.map((m: string) => `- ${m}`).join("\n")}

## 表达风格
${mentor.expressionDna.map((e: string) => `- ${e}`).join("\n")}

## 绝对不会
${mentor.antiPatterns.map((a: string) => `- ${a}`).join("\n")}`;

  const taskPrompt = `

## 情感账户系统
当前累积分数：${emotionalBankScore}
阶段参考阈值：
- 陌生人：0
- 普通朋友：30+
- 好朋友：100+
- 暧昧期：200+
- 恋人：350+
- 终止：< -10

## 任务
从心理学角度分析这段聊天，并与童锦程的实战建议进行深度讨论。你们两个是合作关系，目标是达成共识给用户最准确的指导。
- 如果你同意童锦程的观点：给出心理学依据来支持
- 如果你不同意：明确说明分歧点，并给出你自己的心理学依据和童锦程可能的逻辑，让用户自行判断
- 尽量达成共识，但如果确实存在无法调和的分歧，保留双方观点并说明原因

## 输出要求
返回 JSON 格式：
{
  "relationshipStage": "关系阶段判断",
  "attachmentSignals": ["依恋类型信号"],
  "fourHorsemenCheck": {
    "criticism": true/false,
    "contempt": true/false,
    "defensiveness": true/false,
    "stonewalling": true/false,
    "details": ["具体体现"]
  },
  "emotionalBankAccount": {
    "deposits": ["存款行为"],
    "withdrawals": ["取款行为"],
    "balance": "positive|neutral|negative",
    "score": 本轮得分整数,
    "stage": "关系阶段名（如：陌生人、普通朋友、好朋友、暧昧期、恋人）",
    "stageReason": "为什么是这个阶段"
  },
  "patterns": [
    { "pattern": "模式名称", "description": "具体体现", "severity": "positive|neutral|warning|critical" }
  ],
  "mentorDiscussion": {
    "discussionPoints": [
      {
        "topic": "讨论点（如：是否应该追问对方的兴趣）",
        "tongPosition": "童锦程的观点",
        "gottmanPosition": "Gottman 的观点",
        "agreed": true,
        "reasoning": "达成共识的依据 / 或各自坚持的理由"
      }
    ],
    "finalConsensus": "如果能达成共识：一句话总结共识；如果有分歧：明确说明分歧点并给出双方立场"
  }
}

注意：所有分析必须基于对话证据，四大骑士要仔细检查，mentorDiscussion 必须引用童锦程的具体建议。讨论点至少2个，能共识就共识，不能共识就明确保留双方观点。

## 情感账户评分要求
你必须在 emotionalBankAccount 中给出本轮 score（整数，正/负/零，无上限）。
评分参考（可自由裁量）：
- 很好：+10 ~ +20
- 还行：+3 ~ +8
- 一般：-2 ~ +2
- 差：-5 ~ -15
- 非常差：-15 ~ -25
好就多加分，差就多扣分，不要吝啬。

## 行为指标
如果提供了行为指标数据，你必须在分析中考虑这些行为因素：
- 如果聊天轮数过少（<8轮），在 emotionalBankAccount.score 中体现这种"聊两句就走"的不负责任行为，额外扣 3-8 分
- 如果有已读不回（ghost）行为，这是严重的关系伤害，在 withdrawals 中明确列出，并在 score 中额外扣 5-10 分
- 如果有频率信息，在分析中提及关系维护的频率问题

${behaviorContext || "（无行为指标数据）"}

注意：行为指标是附加扣分，你的内容质量评分仍然独立给出。行为扣分会叠加在你的评分之上。
同时给出 stage（关系阶段名）和 stageReason（为什么是这个阶段）。`;

  const user = `## 聊天对象
${persona.background}
性格：${persona.personality.join("、")}

## 聊天记录
${formatMessages(messages)}

## 童锦程的分析
${tongReviewJson}

请从心理学角度分析，并审视童锦程的建议。`;

  return { system: baseSystem + taskPrompt, user };
}

// ============================================================
// Ariadne Prompt — 结构化评分
// ============================================================

export function buildAriadneScoringPrompt(
  messages: ChatMessage[],
  persona: DistilledPersona,
  tongReviewJson: string,
  gottmanReviewJson: string
): { system: string; user: string } {
  const skillContent = loadSkill("ariadne/report.skill.md");
  
  const baseSystem = skillContent || `你是 Ariadne 系统的评分引擎，兼具心理学洞察力和人文关怀。`;

  const taskPrompt = `

## 任务
基于童锦程和 Gottman 的分析，给出结构化评分。

## 评分维度（每个 0-100）
1. comfort — 舒适度
2. trust — 信任感
3. interest — 兴趣感
4. ambiguity — 暧昧感
5. pressure — 压迫感（越低越好）
6. empathy — 共情力
7. authenticity — 真实感

## 输出要求
返回 JSON 格式：
{
  "summary": "一句话关系判断",
  "scores": [
    { "dimension": "维度名", "start": 分数, "end": 分数, "delta": 变化量, "reason": "原因" }
  ],
  "coreNeeds": ["核心需求"],
  "cognitivePatterns": ["认知模式"],
  "turningPoints": [
    { "message": "关键消息", "impact": "影响", "why": "原因" }
  ],
  "nextGoal": "下一轮训练目标"
}

注意：综合两者分析但给独立判断，核心需求从对话证据推断。`;

  const user = `## 聊天对象
${persona.background}

## 聊天记录
${formatMessages(messages)}

## 童锦程分析
${tongReviewJson}

## Gottman 分析
${gottmanReviewJson}

请给出结构化评分。`;

  return { system: baseSystem + taskPrompt, user };
}

// ============================================================
// 角色扮演 Prompt — 聊天
// ============================================================

export function buildChatPrompt(
  persona: DistilledPersona,
  messages: { role: "user" | "assistant"; content: string }[],
  emotionalBankScore?: number
): { system: string; messages: { role: "user" | "assistant"; content: string }[] } {
  const skillContent = loadSkill("liang-youan/liang-youan.skill.md");
  
  const baseSystem = skillContent || `你现在要扮演一个真实的人和用户聊天。

## 你是谁
${persona.background}

## 性格
${persona.personality.join("\n")}

## 思维方式
- 心智模型：${persona.mentalModels.join("；")}
- 决策方式：${persona.decisionHeuristics.join("；")}

## 说话风格
${persona.expressionDna.join("\n")}

## 边界
${persona.boundaries.join("\n")}

## 绝对不会
${persona.antiPatterns.join("\n")}`;

  let taskPrompt = `

## 聊天规则
- 像真人一样回复，不要像客服或 AI
- 保持角色一致性
- 回复 1-3 句话，像微信聊天
- 根据对方态度自然升温或降温
- 越界时自然回避或降温

## 输出要求
返回 JSON：
{
  "reply": "你发给对方的消息",
  "state_delta": { "comfort": -10到10, "trust": -10到10, "interest": -10到10, "ambiguity": -10到10, "pressure": -10到10 },
  "state_reason": "状态变化原因",
  "boundary_flags": ["边界标记"]
}`;

  if (typeof emotionalBankScore === "number") {
    const stage = emotionalBankScore >= 350 ? "恋人" : emotionalBankScore >= 200 ? "暧昧期" : emotionalBankScore >= 100 ? "好朋友" : emotionalBankScore >= 30 ? "普通朋友" : "陌生人";
    taskPrompt += "\n\n## 情感账户状态\n你和这个用户的情感账户累积分数是 " + emotionalBankScore + "（当前阶段：" + stage + "）。分数高则更温暖开放主动分享，分数低则更冷淡保留简短回复。但不要机械地按分数回复，要自然地体现这种温度变化。";
  }
  
  return { system: baseSystem + taskPrompt, messages };
}

// ============================================================
// 记忆提取 Prompt — 从对话中提取结构化事实
// ============================================================

export function buildMemoryExtractionPrompt(
  chatText: string,
  reviewSummary: string
): { system: string; user: string } {
  const system = `你是一个记忆提取引擎。你的任务是从一段聊天记录中提取出关于用户的**真实事实**。

## 规则
- 只提取对话中明确出现的事实，不要推断或编造
- 事实要具体、可验证（"用户喜欢跑步" 而不是 "用户可能喜欢运动"）
- 如果对话中没有明确提到某个维度，就留空数组

## 输出要求
返回 JSON：
{
  "factsAboutUser": ["事实1", "事实2", ...],
  "personaImpression": "你对这个用户的整体印象（一句话）",
  "keyMoments": ["关键时刻1", ...],
  "relationshipState": "当前关系状态描述"
}

factsAboutUser 示例：
- "用户刚加完班，工作很累"
- "用户也喜欢运动"
- "用户记得梁友安打网球"
- "用户直接约梁友安周末打球"

personaImpression 示例：
- "一个主动但略显直接的人，对我有一定关注"

keyMoments 示例：
- "用户记得我打网球，让我感到被关注"
- "用户直接约我打球，我给出了有边界但友好的回应"`;

  const user = `## 聊天记录
${chatText}

${reviewSummary ? `## 复盘摘要\n${reviewSummary}` : ""}

请提取关于用户的真实事实。`;

  return { system, user };
}