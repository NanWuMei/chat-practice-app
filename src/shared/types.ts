// 情感聊天练习系统 — 类型定义
// 镜子模式：不评分，不给改法，只提问

// ============================================================
// 关键时刻系统
// ============================================================

export type KMType = 'KM_A' | 'KM_B' | 'KM_C' | 'KM_D' | 'KM_E' | 'KM_F';

export const KM_TYPE_LABELS: Record<KMType, string> = {
  KM_A: '她回复特别长',
  KM_B: '她回复特别短',
  KM_C: '你分享了自己',
  KM_D: '你连续追问未分享',
  KM_E: '她主动发起新话题',
  KM_F: '对话中断',
};

export type KMContextEntry = {
  index: number;
  speaker: 'USER' | 'HER';
  content: string;
};

export type KeyMoment = {
  km_id: number;
  type: KMType;
  type_label: string;
  trigger_index: number;
  context: KMContextEntry[];
  meta: Record<string, unknown>;
  system_question: string;
  user_answer: string | null;
  answered: boolean;
};

// ============================================================
// M0：输入预处理
// ============================================================

export type M0LogEntry = {
  index: number;
  speaker: 'USER' | 'HER';
  content: string;
};

export type M0Output = {
  session_id: string;
  stats: {
    total_messages: number;
    user_count: number;
    her_count: number;
    avg_her_length: number;
    baseline_her_length: number;
  };
  log: M0LogEntry[];
};

// ============================================================
// M1：关键时刻检测（纯算法）
// ============================================================

export type M1Output = {
  key_moments: KeyMoment[];
  km_summary: Record<KMType, number>;
};

// ============================================================
// M2：苏格拉底提问（唯一AI调用）
// ============================================================

export type M2Question = {
  km_id: number;
  question: string;
};

export type M2Output = {
  questions: M2Question[];
};

// ============================================================
// M4：模式发现（条件触发，>=5次后）
// ============================================================

export type PatternContextEntry = {
  speaker: 'USER' | 'HER';
  content: string;
};

export type PatternItem = {
  session_date: string;
  user_answer: string;
  question: string;
  context?: PatternContextEntry[];
};

export type PatternGroup = {
  km_type: KMType;
  km_label: string;
  frequency: number;
  items: PatternItem[];
};

export type PatternDiscovery = {
  patterns: PatternGroup[];
  aggregate_question?: string;
};

// ============================================================
// 复盘Session存档
// ============================================================

// ============================================================
// 行动锚点（CHG-1）
// ============================================================

export type ActionAnchor = {
  content: string;
  created_at: string;
  tracked: boolean;
  outcome: string | null;
};

// ============================================================
// 聚焦器（罗杰斯）
// ============================================================

export type FocuserOption = {
  id: string;              // 'A' | 'B' | 'C'
  label: string;           // ≤25字，第一人称"我"
  trigger: string;         // 场景触发条件
  action: string;          // 行为动作
};

export type FocuserOutput = {
  mirror_summary: string;  // 一句话行为模式镜像
  options: FocuserOption[]; // 2-3个选项
};

export type DebriefSession = {
  session_id: string;
  date: string;
  key_moments: KeyMoment[];
  action_anchor?: ActionAnchor | null;
  resonance_delta: number;
  km_summary: Record<KMType, number>;
  pattern_discovery?: PatternDiscovery;
  focuser?: FocuserOutput | null;
  selected_focus?: string | null;
};

// ============================================================
// 复盘报告（前端展示用）
// ============================================================

export type DebriefReport = {
  session_id: string;
  m0: M0Output;
  m1: M1Output;
  m2: M2Output;
  created_at: string;
};

// ============================================================
// SL-2：关系状态与用户成长
// ============================================================

export type RelationshipStage = '试探期' | '升温期' | '暧昧期' | '突破期';
export type ResonanceLevel = '很高' | '较高' | '中性' | '较低' | '很低';

export type RelationshipState = {
  current_stage: RelationshipStage;
  resonance_score: number;
  resonance_level: ResonanceLevel;
  current_temperature: string;
  last_updated: string;
};

export type RawReflection = {
  session_date: string;
  km_type: KMType | 'ACTION_ANCHOR';
  question: string;
  answer: string;
  context?: PatternContextEntry[];
  outcome?: string | null;
};

export type UserGrowthRecord = {
  user_id: string;
  relationship_state: RelationshipState;
  debrief_sessions: DebriefSession[];
  growth: {
    total_sessions: number;
    pattern_discovery_unlocked: boolean;
    raw_reflections: RawReflection[];
  };
};

// ============================================================
// SL-1：角色卡（DistilledPersona）
// ============================================================

export type PersonaPsychology = {
  attachment_style: string;
  attachment_notes: string;
  emotion_expression: string;
  emotion_expression_notes: string;
};

export type PersonaCommunication = {
  energy_topics: string[];
  sensitive_topics: string[];
  rhythm_preference: string;
  rhythm_notes: string;
  avg_message_length_baseline: number;
};

export type DistilledPersona = {
  id: string;
  name: string;
  source: string;
  role: string;
  mentalModels: string[];
  decisionHeuristics: string[];
  expressionDna: string[];
  antiPatterns: string[];
  honestBoundaries: string[];
  personality: string[];
  chatStyle: string[];
  interests: string[];
  boundaries: string[];
  background: string;
  psychology: PersonaPsychology;
  communication: PersonaCommunication;
  known_patterns: string[];
  meta: {
    created: string;
    last_updated: string;
    session_count: number;
  };
};

// ============================================================
// 聊天消息 & 会话
// ============================================================

export type ChatMessage = {
  id: string;
  sessionId: string;
  role: 'user' | 'persona' | 'system';
  content: string;
  createdAt: string;
};

export type TrainingSession = {
  id: string;
  personaId: string;
  goal: string;
  status: 'active' | 'reviewed';
  turnCount: number;
  createdAt: string;
  updatedAt: string;
};

export type SessionSummary = {
  id: string;
  personaId: string;
  status: 'active' | 'reviewed';
  turnCount: number;
  lastMessage: string;
  lastMessageRole?: 'user' | 'persona' | 'system';
  createdAt: string;
  updatedAt: string;
};

// ============================================================
// AI 聊天回复
// ============================================================

export type ChatModelResult = {
  reply: string;
};

// ============================================================
// 提示（保留）
// ============================================================

export type HintResult = {
  hints: string[];
};
