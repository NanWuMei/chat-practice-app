// ============================================================
// 聊天练习 App v2 — 三导师复盘系统 类型定义
// ============================================================

export type RelationshipMetric =
  | "comfort"
  | "trust"
  | "interest"
  | "ambiguity"
  | "pressure";

export type RelationshipState = Record<RelationshipMetric, number>;
export type RelationshipDelta = Record<RelationshipMetric, number>;

// --- 女娲蒸馏：角色卡 ---

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
  initialState: RelationshipState;
  emotionalBankScore: number;
};

// --- 女娲蒸馏：导师卡 ---

export type MentorCard = {
  id: string;
  name: string;
  role: "practical" | "psychology";
  mentalModels: string[];
  decisionHeuristics: string[];
  expressionDna: string[];
  antiPatterns: string[];
  corePhilosophy: string;
};

// --- 聊天消息 ---

export type ChatMessage = {
  id: string;
  sessionId: string;
  role: "user" | "persona" | "system";
  content: string;
  createdAt: string;
};

// --- 训练会话 ---

export type TrainingSession = {
  id: string;
  personaId: string;
  goal: string;
  status: "active" | "reviewed";
  currentState: RelationshipState;
  turnCount: number;
  createdAt: string;
  updatedAt: string;
  sessionBankScore?: number;
};

// --- 会话摘要（用于历史列表和长期记忆） ---

export type SessionSummary = {
  id: string;
  personaId: string;
  status: "active" | "reviewed";
  turnCount: number;
  lastMessage: string; // 最后一条消息预览
  lastMessageRole?: "user" | "persona" | "system"; // 最后一条消息角色
  createdAt: string;
  updatedAt: string;
  bankScore?: number;
};

// --- AI 聊天回复 ---

export type ChatModelResult = {
  reply: string;
  state_delta: RelationshipDelta;
  state_reason: string;
  boundary_flags: string[];
};

// --- 提示 ---

export type HintResult = {
  hints: string[];
};

// --- 三导师复盘系统 ---

export type MessageReview = {
  userMessage: string;
  rating: "good" | "neutral" | "poor";
  analysis: string;
  betterVersion?: string;
  whyBetter?: string;
  keyPoint?: string;
};

export type TongReview = {
  overallAssessment: string;
  messageReviews: MessageReview[];
  topMistakes: string[];
  topStrengths: string[];
};

export type GottmanPattern = {
  pattern: string;
  description: string;
  severity: "positive" | "neutral" | "warning" | "critical";
};

export type GottmanReview = {
  relationshipStage: string;
  attachmentSignals: string[];
  fourHorsemenCheck: {
    criticism: boolean;
    contempt: boolean;
    defensiveness: boolean;
    stonewalling: boolean;
    details: string[];
  };
  emotionalBankAccount: {
    deposits: string[];
    withdrawals: string[];
    balance: "positive" | "neutral" | "negative";
    score: number;
    stage: string;
    stageReason: string;
  };
  patterns: GottmanPattern[];
  mentorDiscussion: {
    discussionPoints: {
      topic: string;
      tongPosition: string;
      gottmanPosition: string;
      agreed: boolean;
      reasoning: string;
    }[];
    finalConsensus: string;
  };
};

export type AriadneScore = {
  dimension: string;
  start: number;
  end: number;
  delta: number;
  reason: string;
};

export type AriadneScoring = {
  summary: string;
  scores: AriadneScore[];
  coreNeeds: string[];
  cognitivePatterns: string[];
  turningPoints: { message: string; impact: string; why: string }[];
  nextGoal: string;
};


// --- 行为指标 ---

export type BehaviorMetrics = {
  turnCount: number;
  isShortChat: boolean;
  ghostPenalty: number;       // 本次已读不回扣分（0 或 10）
  ghostFromPrevious: number;  // 上次会话被抛弃扣分（0 或 10）
  frequencyDelta: number;     // 频率加分/扣分（+3 / -5 / 0）
  daysSinceLastSession: number | null;
};
export type DualReviewReport = {
  sessionId: string;
  tongReview: TongReview;
  gottmanReview: GottmanReview;
  ariadneScoring: AriadneScoring;
  mergedSummary: string;
  createdAt: string;
  bankScore: number;
  relationshipStage: string;
  stageReason: string;
  behaviorMetrics?: BehaviorMetrics;
};