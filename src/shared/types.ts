export type RelationshipMetric = "comfort" | "trust" | "interest" | "ambiguity" | "pressure";

export type RelationshipState = Record<RelationshipMetric, number>;

export type RelationshipDelta = Record<RelationshipMetric, number>;

export type Persona = {
  id: string;
  name: string;
  archetype: string;
  age: number;
  city: string;
  occupation: string;
  relationshipStage: string;
  recentContext: string;
  personality: string[];
  chatStyle: string[];
  interests: string[];
  boundaries: string[];
  initialState: RelationshipState;
};

export type ChatMessage = {
  id: string;
  sessionId: string;
  role: "user" | "persona";
  content: string;
  createdAt: string;
};

export type TrainingSession = {
  id: string;
  personaId: string;
  goal: string;
  status: "active" | "reviewed";
  currentState: RelationshipState;
  createdAt: string;
  updatedAt: string;
};

export type ChatModelResult = {
  reply: string;
  state_delta: RelationshipDelta;
  state_reason: string;
  boundary_flags: string[];
};

export type ScoreReview = {
  start: number;
  end: number;
  reason: string;
};

export type TurningPoint = {
  user_message: string;
  impact: string;
  why: string;
};

export type BetterVersion = {
  original: string;
  better: string;
  why: string;
};

export type ReviewModelResult = {
  summary: string;
  scores: Record<RelationshipMetric, ScoreReview>;
  turning_points: TurningPoint[];
  better_versions: BetterVersion[];
  next_goal: string;
};

export type HintResult = {
  hints: string[];
};
