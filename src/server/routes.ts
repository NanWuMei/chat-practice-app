import { Router, type Request, type Response } from 'express';
import { randomUUID } from 'crypto';
import type { TrainingSession, SessionSummary, DebriefSession, KMType, PatternDiscovery, PatternContextEntry, FocuserOutput } from '../shared/types';
import { callAIWithRetry } from './ai/provider';
import { buildChatPrompt, buildAggregateSocratesPrompt, buildFocuserPrompt } from './ai/prompts';
import { parseChatModelResult } from '../shared/validators';
import { runMirrorDebrief, updateBaseline } from './ai/review';
import { liangYouan } from './data';
import { seedDefaultData } from './db';
import * as personaService from './services/personaService';
import * as sessionService from './services/sessionService';
import * as growthService from './services/growthService';

const router = Router();

seedDefaultData([liangYouan]);

function addSystemMsg(sessionId: string, content: string): void {
  sessionService.addMessage(sessionId, 'system', content);
}

// ============================================================
// 获取所有角色
// ============================================================

router.get('/api/personas', (_req: Request, res: Response) => {
  res.json(personaService.getAllPersonas());
});

// ============================================================
// 获取角色的会话列表
// ============================================================

router.get('/api/personas/:personaId/sessions', (req: Request, res: Response) => {
  const sessions = sessionService.getSessionsByPersona(req.params.personaId!);
  const summaries: SessionSummary[] = sessions.map((s) => {
    const msgs = sessionService.getMessages(s.id);
    const lastMsg = msgs[msgs.length - 1];
    return {
      id: s.id,
      personaId: s.personaId,
      status: s.status,
      turnCount: s.turnCount,
      lastMessage: lastMsg?.content ?? '',
      lastMessageRole: lastMsg?.role,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    };
  });
  res.json(summaries);
});

// ============================================================
// 创建新会话
// ============================================================

router.post('/api/sessions', (req: Request, res: Response) => {
  const { personaId } = req.body;
  if (!personaId) { res.status(400).json({ error: '缺少 personaId' }); return; }

  const persona = personaService.getPersona(personaId);
  if (!persona) { res.status(404).json({ error: '角色不存在' }); return; }

  const session: TrainingSession = {
    id: randomUUID(),
    personaId,
    goal: '',
    status: 'active',
    turnCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  sessionService.saveSession(session);
  res.json(session);
});

// ============================================================
// 获取会话消息 / 单个会话
// ============================================================

router.get('/api/sessions/:id/messages', (req: Request, res: Response) => {
  res.json(sessionService.getMessages(req.params.id!));
});

router.get('/api/sessions/:id', (req: Request, res: Response) => {
  const session = sessionService.getSession(req.params.id!);
  if (!session) { res.status(404).json({ error: '会话不存在' }); return; }
  res.json(session);
});

// ============================================================
// 发送消息
// ============================================================

router.post('/api/sessions/:id/messages', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { content } = req.body;
  if (!content) { res.status(400).json({ error: '消息内容不能为空' }); return; }

  const session = sessionService.getSession(id!);
  if (!session) { res.status(404).json({ error: '会话不存在' }); return; }
  if (session.status !== 'active') { res.status(400).json({ error: '该会话已结束' }); return; }

  const persona = personaService.getPersona(session.personaId);
  if (!persona) { res.status(404).json({ error: '角色不存在' }); return; }

  const growthRecord = growthService.getOrCreateGrowthRecord(session.personaId);
  const temperature = growthRecord.relationship_state.current_temperature;
  const stage = growthRecord.relationship_state.current_stage;

  const userMsg = sessionService.addMessage(id!, 'user', content);
  const allMessages = sessionService.getMessages(id!);

  try {
    const prompt = buildChatPrompt(allMessages, persona, temperature, stage);
    const raw = await callAIWithRetry(
      [
        { role: 'system', content: prompt.system },
        { role: 'user', content: prompt.user },
      ],
      { temperature: 0.8, maxTokens: 1024 },
    );
    const result = parseChatModelResult(raw);
    const replyMsg = sessionService.addMessage(id!, 'persona', result.reply);

    session.turnCount += 1;
    session.updatedAt = new Date().toISOString();
    sessionService.saveSession(session);

    res.json({ userMessage: userMsg, message: replyMsg });
  } catch (err) {
    console.error('AI 回复失败:', err);
    res.status(500).json({ error: 'AI 回复失败，请重试', detail: err instanceof Error ? err.message : String(err) });
  }
});

// ============================================================
// 运行复盘（M0+M1+M2）
// ============================================================

router.post('/api/sessions/:id/review', async (req: Request, res: Response) => {
  const { id } = req.params;
  const session = sessionService.getSession(id!);
  if (!session) { res.status(404).json({ error: '会话不存在' }); return; }

  const persona = personaService.getPersona(session.personaId);
  if (!persona) { res.status(404).json({ error: '角色不存在' }); return; }

  const chatMsgs = sessionService.getMessages(id!);
  if (chatMsgs.length < 2) { res.status(400).json({ error: '对话太短，无法复盘' }); return; }

  // CHG-2：获取上次未追踪的行动锚点，传给 M2 prompt
  const previousAnchor = growthService.getPreviousUntrackedAnchor(session.personaId);

  try {
    const report = await runMirrorDebrief(chatMsgs, persona, id!, previousAnchor);

    persona.communication.avg_message_length_baseline = updateBaseline(
      persona.communication.avg_message_length_baseline,
      report.m0.stats.avg_her_length,
    );
    persona.meta.session_count += 1;
    persona.meta.last_updated = new Date().toISOString();
    personaService.savePersona(persona);

    sessionService.saveReview(id!, report);

    const debriefSession: DebriefSession = {
      session_id: id!,
      date: new Date().toISOString().split('T')[0]!,
      key_moments: report.m1.key_moments,
      action_anchor: null,
      resonance_delta: 0,
      km_summary: report.m1.km_summary,
    };
    sessionService.saveDebriefSession(id!, debriefSession);

    session.status = 'reviewed';
    session.updatedAt = new Date().toISOString();
    sessionService.saveSession(session);

    res.json({ ...report, previous_anchor: previousAnchor });
  } catch (err) {
    console.error('复盘失败:', err);
    res.status(500).json({ error: '复盘生成失败，请重试', detail: err instanceof Error ? err.message : String(err) });
  }
});

// ============================================================
// M3：保存用户反思答案
// ============================================================

router.post('/api/sessions/:id/debrief/answer', (req: Request, res: Response) => {
  const { id } = req.params;
  const { km_id, answer } = req.body;
  if (km_id === undefined || !answer) { res.status(400).json({ error: '缺少 km_id 或 answer' }); return; }

  const debrief = sessionService.getDebriefSession(id!);
  if (!debrief) { res.status(404).json({ error: '复盘记录不存在' }); return; }

  const km = debrief.key_moments.find((k) => k.km_id === km_id);
  if (!km) { res.status(404).json({ error: '关键时刻不存在' }); return; }

  km.user_answer = answer;
  km.answered = true;
  sessionService.saveDebriefSession(id!, debrief);
  res.json({ success: true });
});

// ============================================================
// M3：跳过关键时刻
// ============================================================

router.post('/api/sessions/:id/debrief/skip', (req: Request, res: Response) => {
  const { id } = req.params;
  const { km_id } = req.body;
  if (km_id === undefined) { res.status(400).json({ error: '缺少 km_id' }); return; }

  const debrief = sessionService.getDebriefSession(id!);
  if (!debrief) { res.status(404).json({ error: '复盘记录不存在' }); return; }

  const km = debrief.key_moments.find((k) => k.km_id === km_id);
  if (!km) { res.status(404).json({ error: '关键时刻不存在' }); return; }

  km.answered = false;
  km.user_answer = null;
  sessionService.saveDebriefSession(id!, debrief);
  res.json({ success: true });
});
  // ============================================================
  // 罗杰斯聚焦器 — 生成行动选项
  // ============================================================

  router.post('/api/sessions/:id/debrief/focuser', async (req: Request, res: Response) => {
    const { id } = req.params;
    const session = sessionService.getSession(id!);
    if (!session) { res.status(404).json({ error: '会话不存在' }); return; }

    const debrief = sessionService.getDebriefSession(id!);
    if (!debrief) { res.status(404).json({ error: '复盘记录不存在' }); return; }

    // 读取对话记录统计
    const chatMsgs = sessionService.getMessages(id!);
    if (!chatMsgs || chatMsgs.length < 2) { res.status(400).json({ error: '对话太短' }); return; }

    // 计算 M0 统计数据
    const userMsgs = chatMsgs.filter((m) => m.role === 'user');
    const personaMsgs = chatMsgs.filter((m) => m.role === 'persona');
    const avgHerLength = personaMsgs.length > 0
      ? Math.round(personaMsgs.reduce((sum, m) => sum + m.content.length, 0) / personaMsgs.length)
      : 0;

    const persona = personaService.getPersona(session.personaId);
    const baselineHerLength = persona?.communication.avg_message_length_baseline ?? 0;

    const m0Stats = {
      total_messages: chatMsgs.length,
      user_count: userMsgs.length,
      her_count: personaMsgs.length,
      avg_her_length: avgHerLength,
      baseline_her_length: baselineHerLength,
    };

    // 读取上次锚点
    const previousAnchor = growthService.getPreviousUntrackedAnchor(session.personaId);

    try {
      const prompt = buildFocuserPrompt(debrief, m0Stats, previousAnchor);
      const raw = await callAIWithRetry(
        [
          { role: 'system', content: prompt.system },
          { role: 'user', content: prompt.user },
        ],
        { temperature: 0.7, maxTokens: 800 },
      );

      // raw 已经被 callAIWithRetry/extractJSON 解析过，直接验证结构
      const parsed = raw as Record<string, unknown>;
      if (!parsed || typeof parsed.mirror_summary !== 'string' || !Array.isArray(parsed.options) || parsed.options.length === 0) {
        console.warn('聚焦器返回结构无效，降级为 null');
        res.json({ focuser: null, fallback: true });
        return;
      }
      const focuser: FocuserOutput = {
        mirror_summary: parsed.mirror_summary as string,
        options: (parsed.options as Array<Record<string, unknown>>).map((o) => ({
          id: String(o.id ?? ''),
          label: String(o.label ?? ''),
          trigger: String(o.trigger ?? ''),
          action: String(o.action ?? ''),
        })),
      };

      // 存入 debrief
      debrief.focuser = focuser;
      sessionService.saveDebriefSession(id!, debrief);

      res.json({ focuser, fallback: false });
    } catch (err) {
      console.error('聚焦器生成失败:', err);
      res.json({ focuser: null, fallback: true });
    }
  });


// ============================================================
// CHG-1：M2.5 行动锚点 — 保存
// ============================================================

router.post('/api/sessions/:id/debrief/anchor', (req: Request, res: Response) => {
  const { id } = req.params;
  const { content } = req.body;

  const debrief = sessionService.getDebriefSession(id!);
  if (!debrief) { res.status(404).json({ error: '复盘记录不存在' }); return; }

  if (content && content.trim()) {
    debrief.action_anchor = {
      content: content.trim(),
      created_at: new Date().toISOString(),
      tracked: false,
      outcome: null,
    };
  } else {
    debrief.action_anchor = null;
  }

  sessionService.saveDebriefSession(id!, debrief);
  res.json({ success: true, action_anchor: debrief.action_anchor });
});

// ============================================================
// CHG-2：回溯追踪 — 获取上次未追踪的锚点
// ============================================================

router.get('/api/sessions/:id/debrief/previous-anchor', (req: Request, res: Response) => {
  const { id } = req.params;
  const session = sessionService.getSession(id!);
  if (!session) { res.status(404).json({ error: '会话不存在' }); return; }

  const anchor = growthService.getPreviousUntrackedAnchor(session.personaId);
  res.json({ anchor });
});

// ============================================================
// CHG-2：回溯追踪 — 填写结果
// ============================================================

router.post('/api/sessions/:id/debrief/anchor/track', (req: Request, res: Response) => {
  const { id } = req.params;
  const { outcome } = req.body;
  const session = sessionService.getSession(id!);
  if (!session) { res.status(404).json({ error: '会话不存在' }); return; }

  const success = growthService.trackPreviousAnchor(session.personaId, outcome || '未尝试');
  res.json({ success });
});

// ============================================================
// 复盘完成：M4模式发现 + 隐性账户更新
// ============================================================

router.post('/api/sessions/:id/debrief/complete', async (req: Request, res: Response) => {
  const { id } = req.params;
  const session = sessionService.getSession(id!);
  if (!session) { res.status(404).json({ error: '会话不存在' }); return; }

  const persona = personaService.getPersona(session.personaId);
  if (!persona) { res.status(404).json({ error: '角色不存在' }); return; }

  const debrief = sessionService.getDebriefSession(id!);
  if (!debrief) { res.status(404).json({ error: '复盘记录不存在' }); return; }

  const growthRecord = growthService.getOrCreateGrowthRecord(session.personaId);

  // M4：模式发现（条件触发）
  if (growthRecord.growth.pattern_discovery_unlocked) {
    const patterns = aggregatePatterns(growthRecord.growth.raw_reflections, debrief);
    if (patterns.patterns.length > 0) {
      for (const pattern of patterns.patterns) {
        try {
          const prompt = buildAggregateSocratesPrompt(
            pattern.km_label,
            pattern.items.map((i) => ({ date: i.session_date, answer: i.user_answer })),
          );
          const raw = await callAIWithRetry(
            [{ role: 'system', content: prompt.system }, { role: 'user', content: prompt.user }],
            { temperature: 0.7, maxTokens: 256 },
          );
          if (typeof raw === 'string') {
            patterns.aggregate_question = raw.trim();
          }
        } catch (err) {
          console.warn('M4聚合问题生成失败:', err);
        }
      }
      debrief.pattern_discovery = patterns;
    }
  }

  // 隐性更新关系状态
  growthService.updateAfterDebrief(
    session.personaId,
    debrief,
    persona.communication.avg_message_length_baseline,
    0,
  );

  sessionService.saveDebriefSession(id!, debrief);
  addSystemMsg(id!, '已存档。');
  res.json({ success: true, pattern_discovery: debrief.pattern_discovery });
});

// ============================================================
// 获取复盘报告/存档
// ============================================================

router.get('/api/sessions/:id/review', (req: Request, res: Response) => {
  const review = sessionService.getReview(req.params.id!);
  if (!review) { res.status(404).json({ error: '该会话还没有复盘' }); return; }
  res.json(review);
});

router.get('/api/sessions/:id/debrief', (req: Request, res: Response) => {
  const debrief = sessionService.getDebriefSession(req.params.id!);
  if (!debrief) { res.status(404).json({ error: '该会话还没有复盘' }); return; }
  res.json(debrief);
});

// ============================================================
// 删除会话/分身/复制角色
// ============================================================

router.delete('/api/sessions/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const session = sessionService.getSession(id!);
  if (!session) { res.status(404).json({ error: '会话不存在' }); return; }
  sessionService.deleteSession(id!);
  console.log('会话已删除：' + id);
  res.json({ success: true });
});

router.delete('/api/personas/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  if (!id.includes('-clone-')) { res.status(400).json({ error: '不能删除原版角色' }); return; }
  const persona = personaService.getPersona(id);
  if (!persona) { res.status(404).json({ error: '角色不存在' }); return; }
  personaService.deletePersona(id);
  console.log('分身已删除：' + id);
  res.json({ success: true });
});

router.post('/api/personas/:id/clone', (req: Request, res: Response) => {
  const { id } = req.params;
  const clone = personaService.clonePersona(id);
  if (!clone) { res.status(404).json({ error: '角色不存在' }); return; }
  console.log('分身创建：' + clone.id);
  res.json(clone);
});

// ============================================================
// 辅助：M4模式聚合
// ============================================================

const KM_LABELS: Record<string, string> = {
  KM_A: '她回复特别长', KM_B: '她回复特别短', KM_C: '你分享了自己',
  KM_D: '你连续追问未分享', KM_E: '她主动发起新话题', KM_F: '对话中断',
  ACTION_ANCHOR: '行动锚点',
};

function extractKmContext(km: import('../shared/types').KeyMoment): PatternContextEntry[] {
  const triggerIdx = km.context.findIndex((c) => c.content.includes('[关键节点]'));
  if (triggerIdx !== -1) {
    const start = Math.max(0, triggerIdx - 1);
    const end = Math.min(km.context.length - 1, triggerIdx + 1);
    return km.context.slice(start, end + 1).map((c) => ({
      speaker: c.speaker,
      content: c.content.replace(' [关键节点]', ''),
    }));
  }
  const trigIdx = km.context.findIndex((c) => c.index === km.trigger_index);
  if (trigIdx !== -1) {
    const start = Math.max(0, trigIdx - 1);
    const end = Math.min(km.context.length - 1, trigIdx + 1);
    return km.context.slice(start, end + 1).map((c) => ({
      speaker: c.speaker,
      content: c.content,
    }));
  }
  return km.context.slice(0, 3).map((c) => ({ speaker: c.speaker, content: c.content }));
}

function aggregatePatterns(
  rawReflections: { session_date: string; km_type: KMType | 'ACTION_ANCHOR'; question: string; answer: string; context?: PatternContextEntry[]; outcome?: string | null }[],
  currentDebrief: DebriefSession,
): PatternDiscovery {
  const MIN_FREQUENCY = 3;
  const MAX_PATTERNS = 3;

  const allReflections: typeof rawReflections = [...rawReflections];
  for (const km of currentDebrief.key_moments) {
    if (km.answered && km.user_answer) {
      allReflections.push({
        session_date: currentDebrief.date,
        km_type: km.type,
        question: km.system_question,
        answer: km.user_answer,
        context: extractKmContext(km),
      });
    }
  }

  const groups: Record<string, typeof allReflections> = {};
  for (const r of allReflections) {
    if (!groups[r.km_type]) groups[r.km_type] = [];
    groups[r.km_type]!.push(r);
  }

  const patterns = Object.entries(groups)
    .filter(([_, items]) => items.length >= MIN_FREQUENCY)
    .map(([kmType, items]) => ({
      km_type: kmType as KMType,
      km_label: KM_LABELS[kmType] ?? kmType,
      frequency: items.length,
      items: items.map((i) => ({
        session_date: i.session_date,
        user_answer: i.answer,
        question: i.question,
        context: i.context,
      })),
    }))
    .sort((a, b) => b.frequency - a.frequency)
    .slice(0, MAX_PATTERNS);

  return { patterns };
}

export default router;
// ============================================================
// 获取角色的关系状态（用于聊天界面）
// ============================================================

router.get('/api/personas/:personaId/growth', (req: Request, res: Response) => {
  const record = growthService.getGrowthRecord(req.params.personaId!);
  if (!record) {
    res.json({
      relationship_state: {
        current_stage: '试探期',
        resonance_score: 0,
        resonance_level: '中性',
        current_temperature: 'T3',
      },
    });
    return;
  }
  res.json({ relationship_state: record.relationship_state });
});


// 获取最后一个行动锚点（不管追踪状态，用于聊天界面顶部显示）
router.get('/api/sessions/:id/last-anchor', (req: Request, res: Response) => {
  const session = sessionService.getSession(req.params.id!);
  if (!session) { res.status(404).json({ error: '会话不存在' }); return; }
  const anchor = growthService.getLastAnchor(session.personaId);
  res.json({ anchor });
});



