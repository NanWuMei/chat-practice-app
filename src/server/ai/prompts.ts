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
// 角色对话 Prompt（含温度系统）—— 加载梁友安 skill
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
    '==== 思维操作系统 ====',
    skillContent,
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
// M2 苏格拉底提问 Prompt —— 加载苏格拉底 skill
// ============================================================

export function buildSocratesPrompt(m1: M1Output, previousAnchor?: ActionAnchor | null): { system: string; user: string } {
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
// M4 聚合问题 Prompt —— 加载苏格拉底 skill
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
// 罗杰斯聚焦器 Prompt —— 加载卡尔·罗杰斯 skill
// ============================================================

export function buildFocuserPrompt(
  debrief: import('../../shared/types').DebriefSession,
  m0Stats: M0Output['stats'],
  previousAnchor?: ActionAnchor | null,
): { system: string; user: string } {
  const skillContent = loadSkill('carl-rogers-perspective/carl-rogers-perspective.skill.md');

  const system = [
    '==== 卡尔·罗杰斯思维操作系统 ====',
    skillContent,
    '',
    '## 当前任务',
    '',
    '你需要帮用户生成"行动聚焦器"——一段镜像摘要 + 2-3个下一步行动选项。',
    '',
    '你将收到三类输入：',
    '1. 【对话记录】本次会话的聊天记录和关键时刻数据',
    '2. 【上次锚点】用户上次复盘时选择/写的行动锚点及执行反馈',
    '3. 【本次反思】用户在苏格拉底环节填写的所有反思回答',
    '',
    '## 处理规则',
    '',
    '### 镜像摘要（mirror_summary）',
    '- 只描述行为模式，不评价好坏',
    '- 基于对话记录中的客观数据：发消息频率、追问次数、自我暴露次数、关键时刻类型',
    '- 不超过30个字，用"你"开头',
    '- 例："你这次聊了40分钟，问了她8个问题，但没有提到自己的事"',
    '',
    '### 选项生成（options）',
    '每个选项必须满足：',
    '- 【场景触发条件】具体到什么时候（情境+时机），不能是"下次聊天时"这种模糊表述',
    '- 【行为动作】一个可观察、可执行的动作，不能是"多关注自己"这种抽象方向',
    '- 【第一人称】用"我"开头，不用"你应该"',
    '- 【不超过25字】选项全文不超过25个字',
    '',
    '选项之间必须：',
    '- 真正有差异——不是同一方向的不同措辞',
    '- 至少覆盖两个不同的方向（如：一个改变行为，一个调整注意力）',
    '- 有一个选项必须是"先不改，只观察"——给用户不需要立刻行动的出口',
    '',
    '### 数据校准',
    '- 如果上次锚点有 outcome（用户尝试了）→ 选项可以稍有挑战性，在上次基础上推进',
    '- 如果上次锚点没有 outcome 或"未尝试"→ 选项偏向巩固或换角度，不加压',
    '- 如果苏格拉底反思中用户表现出困惑/不确定 → 选项语气更柔和，多给观察性选项',
    '- 如果反思中用户有清晰洞察 → 选项可以更聚焦、更行动导向',
    '',
    '### 输出格式',
    '严格输出JSON，不加任何其他内容：',
    '{',
    '  "mirror_summary": "你这次...",',
    '  "options": [',
    '    {"id": "A", "label": "下次她问我时，我先说一句自己的再反问", "trigger": "她问你近况的时候", "action": "先分享自己，再反问回去"},',
    '    {"id": "B", "label": "我留意她主动发新话题时的情绪", "trigger": "她主动换话题的瞬间", "action": "感受她的情绪而不是分析内容"},',
    '    {"id": "C", "label": "这次先不改，我继续按现在的方式聊", "trigger": "任何场景", "action": "保持现状，带着觉察继续"}',
    '  ]',
    '}',
  ].join('\n');

  // 构建对话记录摘要
  const statsStr = [
    '总消息数：' + m0Stats.total_messages,
    '用户消息数：' + m0Stats.user_count,
    '对方消息数：' + m0Stats.her_count,
    '对方平均回复长度：' + m0Stats.avg_her_length + '字',
    '基线回复长度：' + m0Stats.baseline_her_length + '字',
  ].join('，');

  // 关键时刻摘要
  const kmSummaryStr = debrief.key_moments.map((km) => {
    return km.type_label + '（' + km.type + '）';
  }).join('、');

  // 反思回答
  const reflectionsStr = debrief.key_moments
    .filter((km) => km.answered && km.user_answer)
    .map((km) => {
      return '[' + km.type_label + '] 问题："' + km.system_question + '" → 回答："' + km.user_answer + '"';
    })
    .join('\n');

  // 上次锚点
  let anchorStr = '无';
  if (previousAnchor) {
    anchorStr = '"' + previousAnchor.content + '"';
    if (previousAnchor.outcome) {
      anchorStr += '\n用户反馈："' + previousAnchor.outcome + '"';
    } else {
      anchorStr += '\n（尚未反馈执行情况）';
    }
  }

  const user = [
    '=== 对话记录 ===',
    statsStr,
    '关键时刻：' + (kmSummaryStr || '无'),
    '',
    '=== 上次锚点 ===',
    anchorStr,
    '',
    '=== 本次反思 ===',
    reflectionsStr || '（用户跳过了所有反思问题）',
    '',
    '请生成聚焦器。',
  ].join('\n');

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

