import db from '../db';
import type { UserGrowthRecord, RelationshipState, DebriefSession, RawReflection, PatternContextEntry } from '../../shared/types';

// ============================================================
// 用户成长记录管理（交互共振 + 解耦温度）
// ============================================================

export function getGrowthRecord(personaId: string): UserGrowthRecord | null {
  const row = db.prepare('SELECT data FROM user_growth WHERE persona_id = ?').get(personaId) as { data: string } | undefined;
  return row ? JSON.parse(row.data) as UserGrowthRecord : null;
}

export function saveGrowthRecord(personaId: string, record: UserGrowthRecord): void {
  db.prepare('INSERT INTO user_growth (persona_id, data, updated_at) VALUES (?, ?, datetime(\'now\')) ON CONFLICT(persona_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at').run(personaId, JSON.stringify(record));
}

export function getOrCreateGrowthRecord(personaId: string): UserGrowthRecord {
  const existing = getGrowthRecord(personaId);
  if (existing) return existing;

  const initialState: RelationshipState = {
    current_stage: '试探期',
    resonance_score: 0,
    resonance_level: '中性',
    current_temperature: 'T3',
    last_updated: new Date().toISOString().split('T')[0]!,
  };

  const newRecord: UserGrowthRecord = {
    user_id: 'default_user',
    relationship_state: initialState,
    debrief_sessions: [],
    growth: {
      total_sessions: 0,
      pattern_discovery_unlocked: false,
      raw_reflections: [],
    },
  };
  saveGrowthRecord(personaId, newRecord);
  return newRecord;
}

// ============================================================
// 复盘后更新
// ============================================================

const BASE_TEMP_MAP: Record<string, number> = {
  '很高': 5, '较高': 4, '中性': 3, '较低': 2, '很低': 1,
};

// CHG-3：不再使用 STAGE_CEIL_MAP，temperature 由 resonance 独立决定
const STAGE_FLOOR_MAP: Record<string, number> = {
  '突破期': 2,
};

const STAGE_ORDER = ['试探期', '升温期', '暧昧期', '突破期'];

function calculateResonanceDelta(kmSummary: Record<string, number>): number {
  const positive = (kmSummary['KM_A'] ?? 0) + (kmSummary['KM_E'] ?? 0);
  const negative = (kmSummary['KM_B'] ?? 0) + (kmSummary['KM_F'] ?? 0);
  const net = positive - negative;

  if (net >= 2) return 2;
  if (net === 1) return 1;
  if (net === 0) return 0;
  if (net === -1) return -1;
  return -2;
}

function deriveResonanceLevel(score: number): string {
  if (score >= 3) return '很高';
  if (score >= 1) return '较高';
  if (score >= -1) return '中性';
  if (score >= -3) return '较低';
  return '很低';
}

// 提取关键时刻上下文（触发点前1句+触发点+触发点后1句）
function extractKmContext(km: import('../../shared/types').KeyMoment): PatternContextEntry[] {
  const triggerIdx = km.context.findIndex((c) => c.content.includes('[关键节点]'));
  if (triggerIdx !== -1) {
    const start = Math.max(0, triggerIdx - 1);
    const end = Math.min(km.context.length - 1, triggerIdx + 1);
    return km.context.slice(start, end + 1).map((c) => ({
      speaker: c.speaker,
      content: c.content.replace(' [关键节点]', ''),
    }));
  }
  // 没有标记时，用 trigger_index 匹配
  const trigIdx = km.context.findIndex((c) => c.index === km.trigger_index);
  if (trigIdx !== -1) {
    const start = Math.max(0, trigIdx - 1);
    const end = Math.min(km.context.length - 1, trigIdx + 1);
    return km.context.slice(start, end + 1).map((c) => ({
      speaker: c.speaker,
      content: c.content,
    }));
  }
  // 兜底：取前3条
  return km.context.slice(0, 3).map((c) => ({ speaker: c.speaker, content: c.content }));
}

export function updateAfterDebrief(
  personaId: string,
  debriefSession: DebriefSession,
  baselineHerLength: number,
  avgHerLength: number,
): UserGrowthRecord {
  const record = getOrCreateGrowthRecord(personaId);
  const rs = record.relationship_state;

  // 1. 计算 resonance_delta
  const delta = calculateResonanceDelta(debriefSession.km_summary);
  debriefSession.resonance_delta = delta;

  // 2. 更新 resonance_score（上下限 +/-10）
  rs.resonance_score = Math.max(-10, Math.min(10, rs.resonance_score + delta));

  // 3. 更新 resonance_level
  rs.resonance_level = deriveResonanceLevel(rs.resonance_score) as any;

  // 4. 计算新温度（CHG-3：由 resonance 独立决定，不受 stage 限制）
  const base = BASE_TEMP_MAP[rs.resonance_level] ?? 3;
  const floor = STAGE_FLOOR_MAP[rs.current_stage] ?? 1;
  const newTemp = Math.max(floor, base);
  rs.current_temperature = 'T' + newTemp;

  // 5. 检测阶段变化（基于最近5次 + 本次，独立于温度）
  const recent5 = [...record.debrief_sessions.slice(-4), debriefSession];
  if (recent5.length >= 5) {
    const kmA = recent5.reduce((sum, s) => sum + (s.km_summary['KM_A'] ?? 0), 0);
    const kmE = recent5.reduce((sum, s) => sum + (s.km_summary['KM_E'] ?? 0), 0);
    const kmF = recent5.reduce((sum, s) => sum + (s.km_summary['KM_F'] ?? 0), 0);

    if (rs.current_stage === '试探期' && kmA >= 3 && kmE >= 1) {
      rs.current_stage = '升温期';
    } else if (rs.current_stage === '升温期' && kmE >= 3 && kmF === 0) {
      rs.current_stage = '暧昧期';
    }
  }

  // 回落检测（最近3次）
  const recent3 = [...record.debrief_sessions.slice(-2), debriefSession];
  if (recent3.length >= 3) {
    const recentNeg = recent3.reduce(
      (sum, s) => sum + (s.km_summary['KM_B'] ?? 0) + (s.km_summary['KM_F'] ?? 0), 0
    );
    if (recentNeg >= 4 && rs.current_stage !== '试探期') {
      const idx = STAGE_ORDER.indexOf(rs.current_stage);
      if (idx > 0) rs.current_stage = STAGE_ORDER[idx - 1] as any;
    }
  }

  // 6. 存档session（含 action_anchor）
  record.debrief_sessions.push(debriefSession);
  record.growth.total_sessions += 1;

  // 7. 追加有效反思到 raw_reflections
  for (const km of debriefSession.key_moments) {
    if (km.answered && km.user_answer) {
      record.growth.raw_reflections.push({
        session_date: debriefSession.date,
        km_type: km.type,
        question: km.system_question,
        answer: km.user_answer,
        context: extractKmContext(km),
      });
    }
  }

  // 8. 追加 action_anchor 到 raw_reflections（用于 M4 模式发现）
  if (debriefSession.action_anchor) {
    record.growth.raw_reflections.push({
      session_date: debriefSession.date,
      km_type: 'ACTION_ANCHOR',
      question: '你提出的行为实验',
      answer: debriefSession.action_anchor.content,
      outcome: debriefSession.action_anchor.outcome,
    });
  }

  // 9. 检查V2解锁
  if (record.growth.total_sessions >= 5) {
    record.growth.pattern_discovery_unlocked = true;
  }

  // 10. 更新SL-1基线（不变）
  // baseline 更新在 routes.ts 的 review endpoint 中处理

  rs.last_updated = new Date().toISOString().split('T')[0]!;

  saveGrowthRecord(personaId, record);
  return record;
}

// ============================================================
// CHG-2：查找上次未追踪的行动锚点
// ============================================================

export function getPreviousUntrackedAnchor(personaId: string): import('../../shared/types').ActionAnchor | null {
  const record = getGrowthRecord(personaId);
  if (!record || record.debrief_sessions.length === 0) return null;

  const lastSession = record.debrief_sessions[record.debrief_sessions.length - 1];
  if (!lastSession?.action_anchor) return null;
  if (lastSession.action_anchor.tracked) return null;

  return lastSession.action_anchor;
}

export function trackPreviousAnchor(personaId: string, outcome: string): boolean {
  const record = getGrowthRecord(personaId);
  if (!record || record.debrief_sessions.length === 0) return false;

  const lastSession = record.debrief_sessions[record.debrief_sessions.length - 1];
  if (!lastSession?.action_anchor || lastSession.action_anchor.tracked) return false;

  lastSession.action_anchor.tracked = true;
  lastSession.action_anchor.outcome = outcome;
  saveGrowthRecord(personaId, record);
  return true;
}


// 获取最后一个行动锚点（不管追踪状态，用于聊天界面显示）
export function getLastAnchor(personaId: string): import('../../shared/types').ActionAnchor | null {
  const record = getGrowthRecord(personaId);
  if (!record || record.debrief_sessions.length === 0) return null;

  // 从后往前找第一个有 action_anchor 的 session
  for (let i = record.debrief_sessions.length - 1; i >= 0; i--) {
    const session = record.debrief_sessions[i];
    if (session?.action_anchor && session.action_anchor.content) {
      return session.action_anchor;
    }
  }
  return null;
}