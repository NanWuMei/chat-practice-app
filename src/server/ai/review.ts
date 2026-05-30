import type {
  ChatMessage,
  DistilledPersona,
  M0Output,
  M1Output,
  M2Output,
  DebriefReport,
  KMType,
  KeyMoment,
  ActionAnchor,
} from '../../shared/types';
import { callAIWithRetry } from './provider';
import { preprocessMessages } from './preprocess';
import { buildSocratesPrompt } from './prompts';
import { parseM2Output } from '../../shared/validators';

// ============================================================
// runMirrorDebrief — 镜子模式复盘
// M0（同步）-> M1（同步，纯算法）-> M2（1次AI调用）
// ============================================================

export async function runMirrorDebrief(
  messages: ChatMessage[],
  persona: DistilledPersona,
  sessionId: string,
  previousAnchor?: ActionAnchor | null,
): Promise<DebriefReport> {
  // M0：预处理
  console.log('M0：预处理...');
  const baselineHerLength = persona.communication.avg_message_length_baseline;
  const m0 = preprocessMessages(messages, sessionId, baselineHerLength);
  console.log('M0完成：' + m0.stats.total_messages + '条消息，her基线=' + baselineHerLength + '，本次=' + m0.stats.avg_her_length);

  // M1：关键时刻检测（纯算法）
  console.log('M1：关键时刻检测...');
  const m1 = detectKeyMoments(m0);
  console.log('M1完成：' + m1.key_moments.length + '个关键时刻');

  // M2：苏格拉底提问（唯一AI调用）
  console.log('M2：苏格拉底提问...');
  let m2: M2Output;
  if (m1.key_moments.length === 0) {
    m2 = { questions: [] };
    console.log('M2跳过：无关键时刻');
  } else {
    const prompt = buildSocratesPrompt(m1, previousAnchor);
    const raw = await callAIWithRetry(
      [
        { role: 'system', content: prompt.system },
        { role: 'user', content: prompt.user },
      ],
      { temperature: 0.7, maxTokens: 1024 },
    );
    m2 = parseM2Output(raw);

    // 将问题写入对应的key_moment
    for (const q of m2.questions) {
      const km = m1.key_moments.find((k) => k.km_id === q.km_id);
      if (km) km.system_question = q.question;
    }
    console.log('M2完成：' + m2.questions.length + '个问题');
  }

  return {
    session_id: sessionId,
    m0,
    m1,
    m2,
    created_at: new Date().toISOString(),
  };
}

// ============================================================
// M1：关键时刻检测（纯规则，无AI）
// ============================================================

// 问题检测：中英文问号 + 疑问词
function isQuestion(text: string): boolean {
  if (text.includes('?') || text.includes('?')) return true;
  // "吗" "呢" "嘛" "么" 结尾 = 真疑问
  const realQWords = ['吗', '呢', '嘛', '么'];
  if (realQWords.some((w) => text.endsWith(w))) return true;
  // "吧" 结尾需要排除确认类（好吧/对吧/行吧/是吧/那吧/算了吧）
  if (text.endsWith('吧')) {
    const confirmPatterns = ['好吧', '对吧', '行吧', '是吧', '那吧', '算了', '可以吧', '行不行吧'];
    if (confirmPatterns.some((p) => text.includes(p))) return false;
    return true; // "去吧" "吃吧" 等祈使句不算疑问，但 "你去吧" 有歧义，保守处理
  }
  // "呀" 结尾通常是感叹，不算疑问
  return false;
}

// 自我分享检测：含"我" + 深层感受/经历/观点类词，排除短句、寒暄和浅层表达
function isSharing(text: string): boolean {
  if (text.length < 12) return false; // 太短不算（提高到12字）
  const hasI = text.includes('我');
  if (!hasI) return false;
  // 排除纯提问
  if (isQuestion(text)) return false;
  // 排除寒暄套话
  const greetings = ['你好', '在吗', '嗯', '哦', '好', '行', '好的'];
  if (greetings.some((g) => text.trim() === g)) return false;
  // 深层感受/经历类词（排除"看""做""吃""试"等太常见的动词）
  const deepWords = ['觉得', '感觉', '喜欢', '认为', '发现', '经历', '希望', '累', '烦', '开心', '难过', '紧张', '不好意思', '不好意思', '感动', '害怕', '担心', '期待', '后悔', '骄傲', '尴尬', '失望', '满足'];
  const hasDeep = deepWords.some((w) => text.includes(w));
  // 意愿/计划类（需要"想"+具体内容，不能只是"我想..."）
  const hasPlan = text.includes('想试') || text.includes('想学') || text.includes('想做') || text.includes('想去') || text.includes('想要') || text.includes('打算');
  // 观点类（需要更完整的表达）
  const hasOpinion = text.includes('其实') || text.includes('说实话') || text.includes('我一直') || text.includes('我以前') || text.includes('我发现');
  return hasDeep || hasPlan || hasOpinion;
}

// 新话题检测：比较当前消息与前一条的消息内容是否有实质性变化
function isNewTopic(current: string, previous: string): boolean {
  // 提取关键词（去掉标点和常见虚词）
  const clean = (s: string) => s.replace(/[，。！？、；：""''（）\s,.!?;:()\[\]{}]/g, '');
  const curWords = new Set(clean(current).split(''));
  const prevWords = new Set(clean(previous).split(''));
  // 计算字符重叠率
  let overlap = 0;
  for (const w of curWords) { if (prevWords.has(w)) overlap++; }
  const ratio = curWords.size > 0 ? overlap / curWords.size : 0;
  // 重叠率 < 30% 认为是新话题
  return ratio < 0.3;
}

function detectKeyMoments(m0: M0Output): M1Output {
  const log = m0.log;
  // baseline：用历史基线，若为0（首次）则用15作为默认值
  const baseline = m0.stats.baseline_her_length > 0 ? m0.stats.baseline_her_length : 15;
  const candidates: KeyMoment[] = [];

  // 追踪连续追问状态
  let consecutiveQuestions = 0;
  let lastUserShareIdx = -1; // 追踪上次用户分享的位置

  for (let i = 0; i < log.length; i++) {
    const entry = log[i]!;

    if (entry.speaker === 'USER') {
      if (isQuestion(entry.content)) {
        consecutiveQuestions++;
      } else {
        // KM_C：用户分享了自己的经历/感受
        if (isSharing(entry.content)) {
          candidates.push(createKM(candidates.length + 1, 'KM_C', i, log));
          lastUserShareIdx = i;
        }
        consecutiveQuestions = 0;
      }

      // KM_D：连续追问 >= 3（且中间没有分享）
      if (consecutiveQuestions >= 3) {
        candidates.push(createKM(candidates.length + 1, 'KM_D', i, log, { consecutive_questions: consecutiveQuestions }));
        consecutiveQuestions = 0;
      }
    }

    if (entry.speaker === 'HER') {
      // KM_A：她回复特别长（绝对长度 > 30 或相对长度 > baseline*1.5）
      const isLong = entry.content.length > 30 || (baseline > 0 && entry.content.length > baseline * 1.5);
      if (isLong) {
        candidates.push(createKM(candidates.length + 1, 'KM_A', i, log));
      }

      // KM_B：她回复特别短（baseline有数据时，且排除单字回复"嗯""哦"等正常应答）
      const isShort = entry.content.length < baseline * 0.5 && entry.content.length < 15;
      const isNormalAck = ['嗯', '哦', '好', '行', '嗯。', '哦。', '好。', '行。'].includes(entry.content.trim());
      if (baseline > 10 && isShort && !isNormalAck) {
        candidates.push(createKM(candidates.length + 1, 'KM_B', i, log));
      }
      // 没有基线时，只在回复异常短（<5字）且不是正常应答时触发
      if (baseline <= 10 && entry.content.length < 5 && !isNormalAck) {
        candidates.push(createKM(candidates.length + 1, 'KM_B', i, log));
      }

      // KM_E：她主动发起新话题（上一条也是她发的，且内容是新话题）
      if (i > 0 && log[i - 1]!.speaker === 'HER' && isNewTopic(entry.content, log[i - 1]!.content)) {
        candidates.push(createKM(candidates.length + 1, 'KM_E', i, log));
      }

      consecutiveQuestions = 0;
    }
  }

  // KM_F：对话中断（以USER消息结束，且最后一条不是寒暄）
  if (log.length > 0 && log[log.length - 1]!.speaker === 'USER') {
    const lastMsg = log[log.length - 1]!.content;
    // 排除正常结尾（"好的""再见"等）
    const normalEndings = ['好的', '再见', '晚安', '拜拜', '下次聊', '好的那下次', '行'];
    if (!normalEndings.some((e) => lastMsg.trim().includes(e))) {
      candidates.push(createKM(candidates.length + 1, 'KM_F', log.length - 1, log));
    }
  }

  // 去重：同一类型只保留最有意义的一个（优先靠后的）
  const seen = new Set<string>();
  const deduped: KeyMoment[] = [];
  for (let i = candidates.length - 1; i >= 0; i--) {
    const c = candidates[i]!;
    if (!seen.has(c.type)) {
      seen.add(c.type);
      deduped.unshift(c);
    }
  }

  // 按优先级排序：KM_D > KM_F > KM_E > KM_A > KM_B > KM_C
  const priority: Record<string, number> = { KM_D: 6, KM_F: 5, KM_E: 4, KM_A: 3, KM_B: 2, KM_C: 1 };
  deduped.sort((a, b) => (priority[b.type] ?? 0) - (priority[a.type] ?? 0));
  const selected = deduped.slice(0, 6);

  // 重新编号
  selected.forEach((km, idx) => { km.km_id = idx + 1; });

  // 统计
  const kmSummary: Record<string, number> = { KM_A: 0, KM_B: 0, KM_C: 0, KM_D: 0, KM_E: 0, KM_F: 0 };
  for (const km of selected) {
    kmSummary[km.type] = (kmSummary[km.type] ?? 0) + 1;
  }

  return { key_moments: selected, km_summary: kmSummary as any };
}

const KM_LABELS: Record<string, string> = {
  KM_A: '她回复特别长',
  KM_B: '她回复特别短',
  KM_C: '你分享了自己',
  KM_D: '你连续追问未分享',
  KM_E: '她主动发起新话题',
  KM_F: '对话中断',
};

function createKM(
  id: number,
  type: KMType,
  triggerIdx: number,
  log: M0Output['log'],
  meta: Record<string, unknown> = {},
): KeyMoment {
  // 提取上下文：前3条 + 触发点 + 后3条
  const start = Math.max(0, triggerIdx - 3);
  const end = Math.min(log.length - 1, triggerIdx + 3);
  const context = log.slice(start, end + 1).map((e) => ({
    index: e.index,
    speaker: e.speaker,
    content: e.index === log[triggerIdx]!.index ? e.content + ' [关键节点]' : e.content,
  }));

  return {
    km_id: id,
    type,
    type_label: KM_LABELS[type] ?? type,
    trigger_index: log[triggerIdx]!.index,
    context,
    meta,
    system_question: '',
    user_answer: null,
    answered: false,
  };
}

// ============================================================
// 更新SL-1基线（M0后调用）
// ============================================================

export function updateBaseline(currentBaseline: number, avgHerLength: number): number {
  if (currentBaseline === 0) return avgHerLength;
  return Math.round(currentBaseline * 0.7 + avgHerLength * 0.3);
}
