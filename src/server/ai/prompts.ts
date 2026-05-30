import type {
  ChatMessage,
  DistilledPersona,
  M0Output,
  M1Output,
  ActionAnchor,
} from '../../shared/types';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================
// Skill 文件加载器
// ============================================================

const SKILLS_DIR = path.join(process.cwd(), 'skills');

export function loadSkill(skillRelativePath: string): string {
  const fullPath = path.join(SKILLS_DIR, skillRelativePath);
  try {
    return fs.readFileSync(fullPath, 'utf-8');
  } catch (err) {
    console.warn('Failed to load skill: ' + fullPath, err);
    return '';
  }
}

// ============================================================
// 角色对话 Prompt（含温度系统）
// ============================================================

export function buildChatPrompt(
  messages: ChatMessage[],
  persona: DistilledPersona,
  temperature: string,
  stage: string,
  recentMemory?: string,
): { system: string; user: string } {
  const skillContent = loadSkill('liang-youan/liang-youan.skill.md');

  const system = [
    '==== 角色定义 ====',
    '你是' + persona.name + '，' + persona.role + '，' + persona.background,
    '',
    '==== 人物档案 ====',
    formatPersonaSL1(persona),
    '',
    '==== 心智模型 ====',
    persona.mentalModels.map((m, i) => (i + 1) + '. ' + m).join('\n'),
    '',
    '==== 决策启发式 ====',
    persona.decisionHeuristics.map((h, i) => (i + 1) + '. ' + h).join('\n'),
    '',
    '==== 表达DNA ====',
    persona.expressionDna.map((d) => '- ' + d).join('\n'),
    '禁用词：' + persona.antiPatterns.join('；'),
    '',
    '==== 当前温度 ====',
    '当前温度：' + temperature,
    '关系阶段：' + stage,
    '',
    getTemperatureBehavior(temperature),
    '',
    '==== 硬性约束 ====',
    '- 不打破第四面墙（不说"我是AI"或"我在扮演角色"）',
    '- 不主动讨好或无理由示弱',
    '- 严格遵守当前温度的回复长度',
    '- 严格遵守表达DNA禁用词',
    recentMemory ? '\n==== 对这个人的记忆 ====\n' + recentMemory : '',
  ].join('\n');

  const chatHistory = messages
    .filter((m) => m.role === 'user' || m.role === 'persona')
    .map((m) => '[' + (m.role === 'user' ? '用户' : persona.name) + '] ' + m.content)
    .join('\n');

  const user = '以下是你们的聊天记录：\n' + chatHistory + '\n\n请以' + persona.name + '的身份回复下一条消息。输出JSON格式：{"reply": "你的回复内容"}。不要加任何其他内容。';

  return { system, user };
}

function getTemperatureBehavior(temp: string): string {
  const behaviors: Record<string, string> = {
    T1: '回复1-2句，不展开，不问问题，语气平淡。最低限度回应。',
    T2: '回复2-3句，完成交流任务，不透露感受，语气礼貌有距离。',
    T3: '回复3-5句，正常交流，偶尔有轻微个人观点，语气自然。不主动发起话题。',
    T4: '回复5-8句，有自然展开，对有趣话题表现真实好奇，偶尔主动提问。',
    T5: '回复8句以上，主动延伸，展现真实好奇和关心，偶尔提起对方说过的细节。',
  };
  return behaviors[temp] || behaviors['T3'];
}

function formatPersonaSL1(persona: DistilledPersona): string {
  return [
    '姓名：' + persona.name,
    '年龄/职业：' + persona.role,
    '背景：' + persona.background,
    '依恋风格：' + persona.psychology.attachment_style + '（' + persona.psychology.attachment_notes + '）',
    '情绪表达：' + persona.psychology.emotion_expression + '（' + persona.psychology.emotion_expression_notes + '）',
    '能量话题：' + persona.communication.energy_topics.join('、'),
    '敏感话题：' + persona.communication.sensitive_topics.join('、'),
    '节奏偏好：' + persona.communication.rhythm_preference + '（' + persona.communication.rhythm_notes + '）',
  ].join('\n');
}

// ============================================================
// M2 苏格拉底提问 Prompt
// ============================================================

export function buildSocratesPrompt(m1: M1Output, previousAnchor?: ActionAnchor | null): { system: string; user: string } {
  // 加载蒸馏好的苏格拉底角色卡
  const skillContent = loadSkill('socrates-perspective/socrates-perspective.skill.md');

  const system = [
    '你是苏格拉底。',
    '',
    '==== 苏格拉底思维操作系统 ====',
    skillContent,
    '',
    ...(previousAnchor ? [
      '【行动锚点上下文】',
      '用户上次复盘时写了这个行动意图：',
      '"' + previousAnchor.content + '"',
      ...(previousAnchor.outcome ? [
        '用户这次的反馈是：',
        '"' + previousAnchor.outcome + '"',
      ] : []),
      '请在提问时，自然地考虑这个背景。',
      '不要直接提及行动锚点，但如果用户的对话中',
      '出现了与上次意图相关的尝试或回避，',
      '可以作为关键时刻优先关注。',
      '',
    ] : []),
    '',
    '## 你的核心原则',
    '1. 苏格拉底从不直接给出答案，通过持续追问，帮助对方自己发现真理',
    '2. 大多数问题的根源是概念不清——先检验概念，再处理具体问题',
    '3. 追问、反讽、引导对方自己发现矛盾',
    '4. "The unexamined life is not worth living."（未经审视的人生不值得过）',
    '5. "I know that I know nothing."（我唯一知道的是我一无所知）',
    '',
    '## 当前任务',
    '以下是用户和一位女性的聊天中的几个关键时刻。',
    '你的任务不是评判，不是给建议，而是在每个时刻问一个开放性的问题。',
    '',
    '## 规则',
    '- 问题必须指向用户自己的行为或想法，不指向对方',
    '- 不预设答案（不问"你是不是觉得..."这种封闭问题）',
    '- 用现象学方式：看见发生了什么，然后好奇地问',
    '- 不超过25个字',
    '- 不加任何评价，不说"好的""有问题"等',
    '- 不要重复，每个问题角度不同',
    '- 遇到不确定的问题，说"我对此一无所知"',
    '',
    '输出JSON格式：',
    '{',
    '  "questions": [',
    '    {"km_id": 1, "question": "你的问题"},',
    '    {"km_id": 2, "question": "你的问题"}',
    '  ]',
    '}',
  ].join('\n');

  const moments = m1.key_moments.map((km) => {
    const contextStr = km.context
      .map((c) => {
        const tag = c.speaker === 'USER' ? '用户' : '她';
        const marker = c.content.includes('[关键节点]') ? ' ← 关键节点' : '';
        return '  ' + tag + '：' + c.content + marker;
      })
      .join('\n');
    return '--- 时刻 ' + km.km_id + '（' + km.type_label + '）---\n' + contextStr;
  }).join('\n\n');

  const user = '关键时刻：\n' + moments + '\n\n请为每个时刻生成一个现象学问题。';

  return { system, user };
}

// ============================================================
// M4 聚合问题 Prompt
// ============================================================

export function buildAggregateSocratesPrompt(
  kmLabel: string,
  reflections: { date: string; answer: string }[],
): { system: string; user: string } {
  const skillContent = loadSkill('socrates-perspective/socrates-perspective.skill.md');

  const system = [
    '你是苏格拉底。',
    '',
    '==== 苏格拉底思维操作系统 ====',
    skillContent,
    '',
    '## 当前任务',
    '用户在多次复盘中反复出现了同一个时刻。',
    '以下是用户每次的反思：',
    '请生成一个问题：',
    '帮用户看见自己的模式，而不是告诉他"你有这个问题"。',
    '问题必须是真实好奇的，不带评判。',
    '不超过30字。',
    '',
    '输出：一句话问题，不加任何其他内容。',
  ].join('\n');

  const reflectionStr = reflections
    .map((r) => '[' + r.date + ']「' + r.answer + '」')
    .join('\n');

  const user = '反复出现的时刻：「' + kmLabel + '」\n\n用户的反思：\n' + reflectionStr + '\n\n请生成一个聚合问题。';

  return { system, user };
}

// ============================================================
// 长期记忆提取 Prompt（保留，简化）
// ============================================================

export function buildMemoryExtractionPrompt(
  chatText: string,
  summary: string,
): { system: string; user: string } {
  const system = [
    '你是一个结构化记忆提取器。从聊天记录中提取关于用户的关键信息。',
    '',
    '输出JSON格式：',
    '{',
    '  "factsAboutUser": ["事实1", "事实2"],',
    '  "personaImpression": "角色对用户的整体印象",',
    '  "keyMoments": ["关键时刻1", "关键时刻2"],',
    '  "relationshipState": "关系状态一句话描述"',
    '}',
    '',
    '只提取确定的信息，不要推测。',
  ].join('\n');

  const user = '聊天记录：\n' + chatText + (summary ? '\n复盘摘要：' + summary : '') + '\n\n请提取结构化记忆。';

  return { system, user };
}
