# 聊天训练 MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local Chinese WeChat-context chat training MVP with persona selection, free-form AI chat, hidden relationship state, optional hints, structured review, and local persistence.

**Architecture:** The app is a React + Vite single-page frontend backed by a Node.js + Express API. SQLite stores personas, sessions, messages, state history, hints, and reviews; the AI layer is isolated behind an OpenAI-compatible adapter so the model provider can be replaced without touching routes or UI.

**Tech Stack:** TypeScript, React, Vite, Express, SQLite via `better-sqlite3`, Vitest, Testing Library, Supertest, Zod, OpenAI-compatible HTTP API through `fetch`.

---

## File Structure

- `package.json`: scripts and dependencies for frontend, backend, tests, and type checking.
- `tsconfig.json`: shared TypeScript compiler settings.
- `tsconfig.node.json`: TypeScript settings for Vite and server scripts.
- `vite.config.ts`: Vite dev server, React plugin, test environment, and API proxy.
- `index.html`: Vite app entry.
- `src/shared/types.ts`: shared TypeScript types for personas, sessions, messages, relationship state, AI contracts, and reviews.
- `src/shared/validators.ts`: Zod schemas and parse helpers for model JSON.
- `src/server/config.ts`: environment variable loading and validation.
- `src/server/db.ts`: SQLite connection, schema creation, row mapping helpers, and seed runner.
- `src/server/personas.ts`: five Chinese persona cards and seed logic.
- `src/server/state.ts`: relationship state defaults, clamping, delta application, and turn limit helpers.
- `src/server/ai/prompts.ts`: Chinese system prompts for chat, hints, and review.
- `src/server/ai/provider.ts`: OpenAI-compatible model adapter plus JSON extraction.
- `src/server/routes.ts`: Express routes for personas, sessions, messages, hints, reviews, and history.
- `src/server/index.ts`: app factory and local server startup.
- `src/client/main.tsx`: React entry.
- `src/client/App.tsx`: top-level screen state and workflow.
- `src/client/api.ts`: typed frontend API client.
- `src/client/styles.css`: restrained WeChat-inspired interface styles.
- `src/client/components/PersonaPicker.tsx`: persona selection and context cards.
- `src/client/components/ChatScreen.tsx`: chat UI, hint action, end-and-review action.
- `src/client/components/ReviewScreen.tsx`: review report display.
- `tests/server/state.test.ts`: relationship state unit tests.
- `tests/server/validators.test.ts`: AI output validation tests.
- `tests/server/routes.test.ts`: API route tests with a fake AI provider and temporary SQLite database.
- `tests/client/App.test.tsx`: core UI flow tests with mocked API responses.
- `.env.example`: required AI and local database environment variables.
- `README.md`: local setup, running, testing, and safety boundary notes.

## Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`
- Create: `vite.config.ts`
- Create: `index.html`
- Create: `.env.example`
- Modify: `.gitignore`

- [ ] **Step 1: Create package manifest**

Create `package.json`:

```json
{
  "name": "chat-practice-app",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "server": "tsx watch src/server/index.ts",
    "dev:all": "concurrently \"npm run server\" \"npm run dev\"",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc -b"
  },
  "dependencies": {
    "better-sqlite3": "^11.10.0",
    "cors": "^2.8.5",
    "dotenv": "^16.4.7",
    "express": "^4.21.2",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "zod": "^3.24.2"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.6.3",
    "@testing-library/react": "^16.2.0",
    "@testing-library/user-event": "^14.6.1",
    "@types/better-sqlite3": "^7.6.12",
    "@types/cors": "^2.8.17",
    "@types/express": "^5.0.0",
    "@types/node": "^22.13.5",
    "@types/react": "^19.0.10",
    "@types/react-dom": "^19.0.4",
    "@types/supertest": "^6.0.2",
    "@vitejs/plugin-react": "^5.0.0",
    "concurrently": "^9.1.2",
    "jsdom": "^26.0.0",
    "supertest": "^7.0.0",
    "tsx": "^4.19.3",
    "typescript": "^5.7.3",
    "vite": "^6.1.1",
    "vitest": "^3.0.5"
  }
}
```

- [ ] **Step 2: Create TypeScript configs**

Create `tsconfig.json`:

```json
{
  "files": [],
  "references": [{ "path": "./tsconfig.node.json" }],
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true
  }
}
```

Create `tsconfig.node.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "allowJs": false,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "types": ["node", "vitest/globals", "@testing-library/jest-dom"]
  },
  "include": ["src", "tests", "vite.config.ts"]
}
```

- [ ] **Step 3: Create Vite config and app shell**

Create `vite.config.ts`:

```ts
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:8787"
    }
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: []
  }
});
```

Create `index.html`:

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>聊天训练</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/client/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 4: Create environment example and update ignore rules**

Create `.env.example`:

```bash
AI_API_BASE_URL=https://api.openai.com/v1
AI_API_KEY=replace-with-your-key
AI_MODEL=gpt-4.1-mini
DATABASE_PATH=./data/chat-practice.sqlite
PORT=8787
```

Modify `.gitignore` so it contains:

```gitignore
.superpowers/
node_modules/
.env
.env.local
data/
dist/
build/
.next/
coverage/
```

- [ ] **Step 5: Install dependencies**

Run: `npm install`

Expected: `package-lock.json` is created and installation exits with code 0.

- [ ] **Step 6: Run scaffold checks**

Run: `npm run typecheck`

Expected: TypeScript reports missing source entry files if `src/client/main.tsx` is not created yet. This is acceptable at this task boundary.

- [ ] **Step 7: Commit scaffold**

```bash
git add package.json package-lock.json tsconfig.json tsconfig.node.json vite.config.ts index.html .env.example .gitignore
git commit -m "chore: scaffold chat practice app"
```

## Task 2: Shared Domain Types and Validators

**Files:**
- Create: `src/shared/types.ts`
- Create: `src/shared/validators.ts`
- Create: `tests/server/validators.test.ts`

- [ ] **Step 1: Write validator tests**

Create `tests/server/validators.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { parseChatModelResult, parseReviewModelResult } from "../../src/shared/validators";

describe("AI output validators", () => {
  it("parses a valid chat model result", () => {
    const result = parseChatModelResult({
      reply: "刚下班，有点累，但还行。",
      state_delta: { comfort: 2, trust: 1, interest: 0, ambiguity: 0, pressure: -1 },
      state_reason: "用户先接住了疲惫情绪，没有急着推进。",
      boundary_flags: []
    });

    expect(result.reply).toContain("刚下班");
    expect(result.state_delta.comfort).toBe(2);
  });

  it("rejects an empty visible reply", () => {
    expect(() =>
      parseChatModelResult({
        reply: "",
        state_delta: { comfort: 0, trust: 0, interest: 0, ambiguity: 0, pressure: 0 },
        state_reason: "空回复不可展示",
        boundary_flags: []
      })
    ).toThrow();
  });

  it("parses a valid review result", () => {
    const result = parseReviewModelResult({
      summary: "她愿意继续聊，但暧昧基础还不够。",
      scores: {
        comfort: { start: 50, end: 56, reason: "回应更轻松。" },
        trust: { start: 40, end: 43, reason: "有少量自我分享。" },
        interest: { start: 45, end: 47, reason: "话题变得具体。" },
        ambiguity: { start: 20, end: 21, reason: "没有明显推进。" },
        pressure: { start: 15, end: 14, reason: "没有逼问。" }
      },
      turning_points: [{ user_message: "那你今天应该挺累吧", impact: "升温", why: "接住了情绪。" }],
      better_versions: [{ original: "在干嘛", better: "我刚收工，你今天也挺忙吧？", why: "先分享自己。" }],
      next_goal: "下次继续围绕她的工作压力轻松展开。"
    });

    expect(result.scores.comfort.end).toBe(56);
    expect(result.next_goal).toContain("下次");
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test -- tests/server/validators.test.ts`

Expected: FAIL because `src/shared/validators.ts` does not exist.

- [ ] **Step 3: Create shared types**

Create `src/shared/types.ts`:

```ts
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
```

- [ ] **Step 4: Create validators**

Create `src/shared/validators.ts`:

```ts
import { z } from "zod";
import type { ChatModelResult, ReviewModelResult } from "./types";

const metricDeltaSchema = z.object({
  comfort: z.number().int().min(-10).max(10),
  trust: z.number().int().min(-10).max(10),
  interest: z.number().int().min(-10).max(10),
  ambiguity: z.number().int().min(-10).max(10),
  pressure: z.number().int().min(-10).max(10)
});

const scoreSchema = z.object({
  start: z.number().int().min(0).max(100),
  end: z.number().int().min(0).max(100),
  reason: z.string().min(1)
});

const chatModelResultSchema = z.object({
  reply: z.string().trim().min(1),
  state_delta: metricDeltaSchema,
  state_reason: z.string().trim().min(1),
  boundary_flags: z.array(z.string().trim().min(1))
});

const reviewModelResultSchema = z.object({
  summary: z.string().trim().min(1),
  scores: z.object({
    comfort: scoreSchema,
    trust: scoreSchema,
    interest: scoreSchema,
    ambiguity: scoreSchema,
    pressure: scoreSchema
  }),
  turning_points: z.array(
    z.object({
      user_message: z.string().trim().min(1),
      impact: z.string().trim().min(1),
      why: z.string().trim().min(1)
    })
  ).min(1).max(4),
  better_versions: z.array(
    z.object({
      original: z.string().trim().min(1),
      better: z.string().trim().min(1),
      why: z.string().trim().min(1)
    })
  ).min(1).max(4),
  next_goal: z.string().trim().min(1)
});

export function parseChatModelResult(input: unknown): ChatModelResult {
  return chatModelResultSchema.parse(input);
}

export function parseReviewModelResult(input: unknown): ReviewModelResult {
  return reviewModelResultSchema.parse(input);
}
```

- [ ] **Step 5: Run validator tests**

Run: `npm test -- tests/server/validators.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit shared contracts**

```bash
git add src/shared/types.ts src/shared/validators.ts tests/server/validators.test.ts
git commit -m "feat: add shared AI contracts"
```

## Task 3: Relationship State Logic

**Files:**
- Create: `src/server/state.ts`
- Create: `tests/server/state.test.ts`

- [ ] **Step 1: Write state tests**

Create `tests/server/state.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { applyDelta, defaultState, shouldSuggestReview } from "../../src/server/state";

describe("relationship state", () => {
  it("starts with balanced defaults", () => {
    expect(defaultState()).toEqual({
      comfort: 50,
      trust: 40,
      interest: 45,
      ambiguity: 20,
      pressure: 15
    });
  });

  it("applies deltas and clamps scores", () => {
    const next = applyDelta(defaultState(), {
      comfort: 70,
      trust: -100,
      interest: 2,
      ambiguity: 3,
      pressure: -40
    });

    expect(next.comfort).toBe(100);
    expect(next.trust).toBe(0);
    expect(next.interest).toBe(47);
    expect(next.ambiguity).toBe(23);
    expect(next.pressure).toBe(0);
  });

  it("suggests review after enough turns or high pressure", () => {
    expect(shouldSuggestReview(8, { ...defaultState(), pressure: 20 })).toBe(false);
    expect(shouldSuggestReview(20, defaultState())).toBe(true);
    expect(shouldSuggestReview(6, { ...defaultState(), pressure: 82 })).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test -- tests/server/state.test.ts`

Expected: FAIL because `src/server/state.ts` does not exist.

- [ ] **Step 3: Implement state logic**

Create `src/server/state.ts`:

```ts
import type { RelationshipDelta, RelationshipState } from "../shared/types";

const MIN_SCORE = 0;
const MAX_SCORE = 100;

export function defaultState(): RelationshipState {
  return {
    comfort: 50,
    trust: 40,
    interest: 45,
    ambiguity: 20,
    pressure: 15
  };
}

export function clampScore(value: number): number {
  return Math.max(MIN_SCORE, Math.min(MAX_SCORE, Math.round(value)));
}

export function applyDelta(current: RelationshipState, delta: RelationshipDelta): RelationshipState {
  return {
    comfort: clampScore(current.comfort + delta.comfort),
    trust: clampScore(current.trust + delta.trust),
    interest: clampScore(current.interest + delta.interest),
    ambiguity: clampScore(current.ambiguity + delta.ambiguity),
    pressure: clampScore(current.pressure + delta.pressure)
  };
}

export function shouldSuggestReview(userTurnCount: number, state: RelationshipState): boolean {
  return userTurnCount >= 20 || state.pressure >= 80;
}
```

- [ ] **Step 4: Run state tests**

Run: `npm test -- tests/server/state.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit state logic**

```bash
git add src/server/state.ts tests/server/state.test.ts
git commit -m "feat: add relationship state logic"
```

## Task 4: SQLite Persistence and Chinese Persona Seeds

**Files:**
- Create: `src/server/personas.ts`
- Create: `src/server/db.ts`
- Modify: `tests/server/routes.test.ts`

- [ ] **Step 1: Write persistence smoke test**

Create `tests/server/routes.test.ts` with only the persona test first:

```ts
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/server/index";
import { createDatabase } from "../../src/server/db";

let db: ReturnType<typeof createDatabase>;

beforeEach(() => {
  db = createDatabase(":memory:");
});

afterEach(() => {
  db.close();
});

describe("persona routes", () => {
  it("returns five Chinese personas", async () => {
    const app = createApp({ db });
    const response = await request(app).get("/api/personas").expect(200);

    expect(response.body).toHaveLength(5);
    expect(response.body[0].name).toMatch(/[一-龥]/);
    expect(response.body[0].initialState.comfort).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run route test to verify failure**

Run: `npm test -- tests/server/routes.test.ts`

Expected: FAIL because server files do not exist.

- [ ] **Step 3: Create persona seeds**

Create `src/server/personas.ts`:

```ts
import type { Persona } from "../shared/types";

export const personas: Persona[] = [
  {
    id: "slow-sincere",
    name: "林夏",
    archetype: "慢热但真诚的同龄女生",
    age: 25,
    city: "杭州",
    occupation: "产品运营",
    relationshipStage: "普通朋友，刚加微信一周",
    recentContext: "最近工作有点忙，回复不算快，但愿意聊生活细节。",
    personality: ["慢热", "真诚", "敏感", "不喜欢被催"],
    chatStyle: ["回复偏短", "熟了会分享日常", "偶尔用表情", "被连续追问会变冷"],
    interests: ["咖啡", "城市散步", "播客", "周末短途"],
    boundaries: ["讨厌查户口", "不喜欢刚熟就暧昧", "被催回复会退缩"],
    initialState: { comfort: 48, trust: 36, interest: 42, ambiguity: 14, pressure: 18 }
  },
  {
    id: "expressive-daily",
    name: "许念",
    archetype: "活泼、爱分享日常的同龄女生",
    age: 24,
    city: "成都",
    occupation: "新媒体编辑",
    relationshipStage: "聊过几次，气氛轻松",
    recentContext: "刚下班，今天拍了几张路边小店的照片。",
    personality: ["外向", "爱笑", "分享欲强", "对无聊问题没耐心"],
    chatStyle: ["消息较长", "喜欢反问", "会用哈哈和表情", "喜欢轻松玩笑"],
    interests: ["探店", "拍照", "音乐节", "小猫视频"],
    boundaries: ["不喜欢说教", "不喜欢油腻夸奖", "不喜欢被评判生活方式"],
    initialState: { comfort: 56, trust: 42, interest: 50, ambiguity: 20, pressure: 12 }
  },
  {
    id: "busy-boundary",
    name: "陈予安",
    archetype: "边界感强、工作或学习很忙的女生",
    age: 26,
    city: "上海",
    occupation: "研究生",
    relationshipStage: "认识但不熟",
    recentContext: "最近在准备论文和实习面试，时间很碎。",
    personality: ["理性", "边界感强", "独立", "慢慢观察"],
    chatStyle: ["回复克制", "不太主动开启话题", "喜欢具体不空泛的交流", "越界会直接降温"],
    interests: ["电影", "展览", "跑步", "职业成长"],
    boundaries: ["讨厌被安排", "讨厌过早邀约", "不接受暧昧压迫"],
    initialState: { comfort: 42, trust: 34, interest: 38, ambiguity: 10, pressure: 20 }
  },
  {
    id: "familiar-friend",
    name: "周晴",
    archetype: "已经比较熟的女性朋友",
    age: 25,
    city: "广州",
    occupation: "设计师",
    relationshipStage: "朋友，偶尔互相吐槽生活",
    recentContext: "你们之前聊过工作压力，她对你不排斥，但关系偏朋友。",
    personality: ["松弛", "会吐槽", "重视默契", "不喜欢突然变味"],
    chatStyle: ["会开玩笑", "熟人语气", "能接梗", "对突然暧昧会打哈哈"],
    interests: ["设计", "剧集", "夜宵", "城市生活"],
    boundaries: ["不喜欢朋友关系被突然逼问", "讨厌强行表白", "不喜欢被情绪绑架"],
    initialState: { comfort: 65, trust: 55, interest: 48, ambiguity: 18, pressure: 10 }
  },
  {
    id: "ambiguous-uncertain",
    name: "沈知遥",
    archetype: "有轻微暧昧但态度不确定的女生",
    age: 24,
    city: "南京",
    occupation: "插画自由职业者",
    relationshipStage: "有一点暧昧，但她还在观察",
    recentContext: "她之前主动分享过画稿，也接过你的玩笑，但最近回复变慢。",
    personality: ["感性", "有一点试探", "需要安全感", "不喜欢被推进太快"],
    chatStyle: ["会轻微调侃", "情绪好时主动", "不确定时会转移话题", "对细腻回应加分"],
    interests: ["插画", "独立书店", "心理学", "深夜散步"],
    boundaries: ["不喜欢被定义关系", "不喜欢压迫式确认", "讨厌性暗示过早"],
    initialState: { comfort: 58, trust: 46, interest: 54, ambiguity: 35, pressure: 16 }
  }
];
```

- [ ] **Step 4: Create database layer**

Create `src/server/db.ts`:

```ts
import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { ChatMessage, Persona, RelationshipState, ReviewModelResult, TrainingSession } from "../shared/types";
import { personas } from "./personas";

export type AppDatabase = ReturnType<typeof createDatabase>;

export function createDatabase(path: string) {
  if (path !== ":memory:") {
    mkdirSync(dirname(path), { recursive: true });
  }

  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  migrate(db);
  seedPersonas(db);

  return {
    raw: db,
    close: () => db.close(),
    listPersonas: () => db.prepare("select * from personas order by rowid asc").all().map(mapPersona),
    getPersona: (id: string) => {
      const row = db.prepare("select * from personas where id = ?").get(id);
      return row ? mapPersona(row) : null;
    },
    createSession: (session: TrainingSession) => {
      db.prepare(
        "insert into sessions (id, persona_id, goal, status, current_state_json, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?)"
      ).run(session.id, session.personaId, session.goal, session.status, JSON.stringify(session.currentState), session.createdAt, session.updatedAt);
    },
    getSession: (id: string) => {
      const row = db.prepare("select * from sessions where id = ?").get(id);
      return row ? mapSession(row) : null;
    },
    updateSessionState: (id: string, state: RelationshipState, status: TrainingSession["status"], updatedAt: string) => {
      db.prepare("update sessions set current_state_json = ?, status = ?, updated_at = ? where id = ?").run(JSON.stringify(state), status, updatedAt, id);
    },
    addMessage: (message: ChatMessage) => {
      db.prepare("insert into messages (id, session_id, role, content, created_at) values (?, ?, ?, ?, ?)").run(
        message.id,
        message.sessionId,
        message.role,
        message.content,
        message.createdAt
      );
    },
    listMessages: (sessionId: string) =>
      db.prepare("select * from messages where session_id = ? order by created_at asc").all(sessionId).map(mapMessage),
    addStateHistory: (sessionId: string, state: RelationshipState, reason: string, createdAt: string) => {
      db.prepare("insert into state_history (session_id, state_json, reason, created_at) values (?, ?, ?, ?)").run(
        sessionId,
        JSON.stringify(state),
        reason,
        createdAt
      );
    },
    listStateHistory: (sessionId: string) =>
      db.prepare("select * from state_history where session_id = ? order by created_at asc").all(sessionId).map((row: any) => ({
        state: JSON.parse(row.state_json) as RelationshipState,
        reason: String(row.reason),
        createdAt: String(row.created_at)
      })),
    saveReview: (sessionId: string, review: ReviewModelResult, createdAt: string) => {
      db.prepare("insert into reviews (session_id, review_json, created_at) values (?, ?, ?)").run(sessionId, JSON.stringify(review), createdAt);
    },
    getReview: (sessionId: string) => {
      const row = db.prepare("select review_json from reviews where session_id = ? order by created_at desc limit 1").get(sessionId) as { review_json: string } | undefined;
      return row ? (JSON.parse(row.review_json) as ReviewModelResult) : null;
    }
  };
}

function migrate(db: Database.Database) {
  db.exec(`
    create table if not exists personas (
      id text primary key,
      json text not null
    );
    create table if not exists sessions (
      id text primary key,
      persona_id text not null,
      goal text not null,
      status text not null,
      current_state_json text not null,
      created_at text not null,
      updated_at text not null
    );
    create table if not exists messages (
      id text primary key,
      session_id text not null,
      role text not null,
      content text not null,
      created_at text not null
    );
    create table if not exists state_history (
      id integer primary key autoincrement,
      session_id text not null,
      state_json text not null,
      reason text not null,
      created_at text not null
    );
    create table if not exists reviews (
      id integer primary key autoincrement,
      session_id text not null,
      review_json text not null,
      created_at text not null
    );
  `);
}

function seedPersonas(db: Database.Database) {
  const insert = db.prepare("insert or replace into personas (id, json) values (?, ?)");
  for (const persona of personas) {
    insert.run(persona.id, JSON.stringify(persona));
  }
}

function mapPersona(row: any): Persona {
  return JSON.parse(String(row.json)) as Persona;
}

function mapSession(row: any): TrainingSession {
  return {
    id: String(row.id),
    personaId: String(row.persona_id),
    goal: String(row.goal),
    status: row.status === "reviewed" ? "reviewed" : "active",
    currentState: JSON.parse(String(row.current_state_json)) as RelationshipState,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

function mapMessage(row: any): ChatMessage {
  return {
    id: String(row.id),
    sessionId: String(row.session_id),
    role: row.role === "persona" ? "persona" : "user",
    content: String(row.content),
    createdAt: String(row.created_at)
  };
}
```

- [ ] **Step 5: Create minimal server app for persona route**

Create `src/server/index.ts`:

```ts
import cors from "cors";
import express from "express";
import { createDatabase, type AppDatabase } from "./db";

type CreateAppOptions = {
  db: AppDatabase;
};

export function createApp({ db }: CreateAppOptions) {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get("/api/personas", (_req, res) => {
    res.json(db.listPersonas());
  });

  return app;
}

if (process.env.NODE_ENV !== "test") {
  const port = Number(process.env.PORT ?? 8787);
  const db = createDatabase(process.env.DATABASE_PATH ?? "./data/chat-practice.sqlite");
  createApp({ db }).listen(port, () => {
    console.log(`聊天训练 API 已启动：http://localhost:${port}`);
  });
}
```

- [ ] **Step 6: Run route test**

Run: `npm test -- tests/server/routes.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit persistence and personas**

```bash
git add src/server/personas.ts src/server/db.ts src/server/index.ts tests/server/routes.test.ts
git commit -m "feat: add local persistence and personas"
```

## Task 5: AI Adapter and Chinese Prompts

**Files:**
- Create: `src/server/config.ts`
- Create: `src/server/ai/prompts.ts`
- Create: `src/server/ai/provider.ts`
- Create: `tests/server/provider.test.ts`

- [ ] **Step 1: Write provider JSON extraction tests**

Create `tests/server/provider.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { extractJsonObject } from "../../src/server/ai/provider";

describe("AI provider helpers", () => {
  it("extracts a plain JSON object", () => {
    expect(extractJsonObject('{"reply":"你好","state_delta":{"comfort":0,"trust":0,"interest":0,"ambiguity":0,"pressure":0},"state_reason":"无变化","boundary_flags":[]}')).toContain('"reply"');
  });

  it("extracts JSON from fenced text", () => {
    const text = '```json\n{"summary":"关系稳定"}\n```';
    expect(extractJsonObject(text)).toBe('{"summary":"关系稳定"}');
  });
});
```

- [ ] **Step 2: Run provider tests to verify failure**

Run: `npm test -- tests/server/provider.test.ts`

Expected: FAIL because `src/server/ai/provider.ts` does not exist.

- [ ] **Step 3: Create config loader**

Create `src/server/config.ts`:

```ts
import "dotenv/config";

export type AppConfig = {
  aiApiBaseUrl: string;
  aiApiKey: string;
  aiModel: string;
  databasePath: string;
  port: number;
};

export function loadConfig(): AppConfig {
  return {
    aiApiBaseUrl: process.env.AI_API_BASE_URL ?? "https://api.openai.com/v1",
    aiApiKey: process.env.AI_API_KEY ?? "",
    aiModel: process.env.AI_MODEL ?? "gpt-4.1-mini",
    databasePath: process.env.DATABASE_PATH ?? "./data/chat-practice.sqlite",
    port: Number(process.env.PORT ?? 8787)
  };
}
```

- [ ] **Step 4: Create Chinese prompts**

Create `src/server/ai/prompts.ts`:

```ts
import type { ChatMessage, Persona, RelationshipState } from "../../shared/types";

export function buildChatPrompt(persona: Persona, messages: ChatMessage[], state: RelationshipState, goal: string): string {
  return `
你正在模拟一个中文微信聊天对象。你不是恋爱教练本人，你只扮演这个女生。

人格：
姓名：${persona.name}
类型：${persona.archetype}
年龄：${persona.age}
城市：${persona.city}
身份：${persona.occupation}
关系阶段：${persona.relationshipStage}
最近状态：${persona.recentContext}
性格：${persona.personality.join("、")}
聊天习惯：${persona.chatStyle.join("、")}
兴趣：${persona.interests.join("、")}
边界：${persona.boundaries.join("、")}

训练目标：${goal}
当前隐藏关系状态：
舒适度 ${state.comfort}，信任感 ${state.trust}，兴趣感 ${state.interest}，暧昧感 ${state.ambiguity}，压迫感 ${state.pressure}

最近聊天：
${messages.map((message) => `${message.role === "user" ? "用户" : persona.name}：${message.content}`).join("\n")}

请只返回 JSON，不要使用 Markdown。格式：
{
  "reply": "你作为${persona.name}发给用户看的微信消息，必须是简体中文，长度自然，不要像客服",
  "state_delta": { "comfort": 0, "trust": 0, "interest": 0, "ambiguity": 0, "pressure": 0 },
  "state_reason": "用一句中文解释状态变化",
  "boundary_flags": []
}

要求：
1. 不要总是配合用户。可以简短、反问、转移话题、降温或主动分享。
2. 如果用户查户口、太急、强行暧昧、性暗示、纠缠或无视拒绝，要自然降温，并提高 pressure。
3. 如果用户接住情绪、适度自我分享、轻松幽默，可以提高 comfort、trust 或 interest。
4. state_delta 每个值必须是 -10 到 10 的整数。
`.trim();
}

export function buildHintPrompt(persona: Persona, messages: ChatMessage[], state: RelationshipState, goal: string): string {
  return `
你是中文关系聊天训练教练。请基于当前微信聊天，给用户 2 到 3 条方向性提示，不要给可复制话术。

对象：${persona.name}，${persona.archetype}
训练目标：${goal}
当前状态：舒适度 ${state.comfort}，信任感 ${state.trust}，兴趣感 ${state.interest}，暧昧感 ${state.ambiguity}，压迫感 ${state.pressure}
最近聊天：
${messages.map((message) => `${message.role === "user" ? "用户" : persona.name}：${message.content}`).join("\n")}

请只返回 JSON：
{ "hints": ["提示一", "提示二"] }
`.trim();
}

export function buildReviewPrompt(persona: Persona, messages: ChatMessage[], stateHistory: { state: RelationshipState; reason: string; createdAt: string }[], goal: string): string {
  return `
你是成熟、直接、不羞辱人的中文关系聊天教练。请复盘这轮微信模拟聊天。

对象：${persona.name}，${persona.archetype}
训练目标：${goal}

完整聊天：
${messages.map((message) => `${message.role === "user" ? "用户" : persona.name}：${message.content}`).join("\n")}

状态历史：
${stateHistory.map((item) => `${item.createdAt} ${JSON.stringify(item.state)} 原因：${item.reason}`).join("\n")}

请只返回 JSON：
{
  "summary": "本轮关系状态的一句话中文判断",
  "scores": {
    "comfort": { "start": 0, "end": 0, "reason": "..." },
    "trust": { "start": 0, "end": 0, "reason": "..." },
    "interest": { "start": 0, "end": 0, "reason": "..." },
    "ambiguity": { "start": 0, "end": 0, "reason": "..." },
    "pressure": { "start": 0, "end": 0, "reason": "..." }
  },
  "turning_points": [{ "user_message": "...", "impact": "...", "why": "..." }],
  "better_versions": [{ "original": "...", "better": "...", "why": "..." }],
  "next_goal": "..."
}

禁止使用“舔狗”“低价值”“直男癌”等羞辱标签。如果出现操控、施压、骚扰、纠缠或无视拒绝，要明确指出边界问题，并引导尊重边界。
`.trim();
}
```

- [ ] **Step 5: Create AI provider**

Create `src/server/ai/provider.ts`:

```ts
import { parseChatModelResult, parseReviewModelResult } from "../../shared/validators";
import type { ChatModelResult, HintResult, ReviewModelResult } from "../../shared/types";
import type { AppConfig } from "../config";

export type AiProvider = {
  completeChat(prompt: string): Promise<ChatModelResult>;
  completeHint(prompt: string): Promise<HintResult>;
  completeReview(prompt: string): Promise<ReviewModelResult>;
};

export function extractJsonObject(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  if (fenced?.[1]) {
    return fenced[1].trim();
  }

  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first >= 0 && last > first) {
    return trimmed.slice(first, last + 1);
  }

  return trimmed;
}

export function createAiProvider(config: AppConfig): AiProvider {
  async function complete(prompt: string): Promise<unknown> {
    if (!config.aiApiKey) {
      throw new Error("缺少 AI_API_KEY，请先配置 .env。");
    }

    const response = await fetch(`${config.aiApiBaseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${config.aiApiKey}`
      },
      body: JSON.stringify({
        model: config.aiModel,
        messages: [
          { role: "system", content: "你必须只输出有效 JSON，不要输出 Markdown 或额外解释。" },
          { role: "user", content: prompt }
        ],
        temperature: 0.8
      })
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`模型调用失败：${response.status} ${body}`);
    }

    const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("模型没有返回可解析内容。");
    }

    return JSON.parse(extractJsonObject(content));
  }

  return {
    completeChat: async (prompt) => parseChatModelResult(await complete(prompt)),
    completeHint: async (prompt) => {
      const raw = await complete(prompt);
      const parsed = raw as HintResult;
      if (!Array.isArray(parsed.hints) || parsed.hints.length === 0) {
        throw new Error("提示模型返回格式不合法。");
      }
      return { hints: parsed.hints.slice(0, 3).map(String) };
    },
    completeReview: async (prompt) => parseReviewModelResult(await complete(prompt))
  };
}
```

- [ ] **Step 6: Run provider tests**

Run: `npm test -- tests/server/provider.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit AI adapter**

```bash
git add src/server/config.ts src/server/ai/prompts.ts src/server/ai/provider.ts tests/server/provider.test.ts
git commit -m "feat: add ai provider and prompts"
```

## Task 6: Session, Chat, Hint, and Review API Routes

**Files:**
- Modify: `src/server/index.ts`
- Create: `src/server/routes.ts`
- Modify: `tests/server/routes.test.ts`

- [ ] **Step 1: Extend route tests with fake AI**

Replace `tests/server/routes.test.ts` with:

```ts
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/server/index";
import { createDatabase } from "../../src/server/db";
import type { AiProvider } from "../../src/server/ai/provider";

let db: ReturnType<typeof createDatabase>;

const fakeAi: AiProvider = {
  completeChat: async () => ({
    reply: "听起来你今天还挺会接话的。",
    state_delta: { comfort: 3, trust: 1, interest: 2, ambiguity: 0, pressure: -1 },
    state_reason: "用户表达轻松，没有连续追问。",
    boundary_flags: []
  }),
  completeHint: async () => ({
    hints: ["先接住她刚才的情绪。", "补一句你自己的类似经历。"]
  }),
  completeReview: async () => ({
    summary: "她愿意继续聊，但暧昧感还不强。",
    scores: {
      comfort: { start: 50, end: 53, reason: "聊天更轻松。" },
      trust: { start: 40, end: 41, reason: "有少量分享。" },
      interest: { start: 45, end: 47, reason: "回应不再单调。" },
      ambiguity: { start: 20, end: 20, reason: "没有推进暧昧。" },
      pressure: { start: 15, end: 14, reason: "没有施压。" }
    },
    turning_points: [{ user_message: "今天辛苦了吧", impact: "升温", why: "接住了疲惫。" }],
    better_versions: [{ original: "在干嘛", better: "我刚忙完，你今天也挺满吧？", why: "先分享自己。" }],
    next_goal: "下一轮继续练习接情绪和轻分享。"
  })
};

beforeEach(() => {
  db = createDatabase(":memory:");
});

afterEach(() => {
  db.close();
});

describe("api routes", () => {
  it("returns five Chinese personas", async () => {
    const app = createApp({ db, ai: fakeAi });
    const response = await request(app).get("/api/personas").expect(200);

    expect(response.body).toHaveLength(5);
    expect(response.body[0].name).toMatch(/[一-龥]/);
  });

  it("creates a session, sends a message, returns hints, and creates a review", async () => {
    const app = createApp({ db, ai: fakeAi });
    const personas = await request(app).get("/api/personas").expect(200);
    const personaId = personas.body[0].id;

    const sessionResponse = await request(app)
      .post("/api/sessions")
      .send({ personaId, goal: "从普通聊天到更熟悉" })
      .expect(201);

    const sessionId = sessionResponse.body.id;
    expect(sessionResponse.body.currentState.comfort).toBeGreaterThan(0);

    const messageResponse = await request(app)
      .post(`/api/sessions/${sessionId}/messages`)
      .send({ content: "今天工作是不是挺累的？" })
      .expect(200);

    expect(messageResponse.body.reply.content).toContain("听起来");
    expect(messageResponse.body.session.currentState.comfort).toBeGreaterThan(sessionResponse.body.currentState.comfort);

    const hintResponse = await request(app).post(`/api/sessions/${sessionId}/hint`).expect(200);
    expect(hintResponse.body.hints[0]).toContain("情绪");

    const reviewResponse = await request(app).post(`/api/sessions/${sessionId}/review`).expect(200);
    expect(reviewResponse.body.summary).toContain("愿意继续聊");
  });

  it("rejects empty messages", async () => {
    const app = createApp({ db, ai: fakeAi });
    const personas = await request(app).get("/api/personas").expect(200);
    const session = await request(app).post("/api/sessions").send({ personaId: personas.body[0].id }).expect(201);

    await request(app).post(`/api/sessions/${session.body.id}/messages`).send({ content: "   " }).expect(400);
  });
});
```

- [ ] **Step 2: Run route tests to verify failure**

Run: `npm test -- tests/server/routes.test.ts`

Expected: FAIL because `createApp` does not accept `ai` and routes are missing.

- [ ] **Step 3: Implement routes**

Create `src/server/routes.ts`:

```ts
import { Router } from "express";
import { randomUUID } from "node:crypto";
import type { AiProvider } from "./ai/provider";
import { buildChatPrompt, buildHintPrompt, buildReviewPrompt } from "./ai/prompts";
import type { AppDatabase } from "./db";
import { applyDelta } from "./state";

export function createRoutes(db: AppDatabase, ai: AiProvider) {
  const router = Router();

  router.get("/personas", (_req, res) => {
    res.json(db.listPersonas());
  });

  router.post("/sessions", (req, res) => {
    const personaId = String(req.body?.personaId ?? "");
    const persona = db.getPersona(personaId);
    if (!persona) {
      return res.status(404).json({ error: "找不到这个模拟对象。" });
    }

    const now = new Date().toISOString();
    const session = {
      id: randomUUID(),
      personaId,
      goal: String(req.body?.goal ?? "从普通聊天到更熟悉"),
      status: "active" as const,
      currentState: persona.initialState,
      createdAt: now,
      updatedAt: now
    };

    db.createSession(session);
    db.addStateHistory(session.id, session.currentState, "会话初始化", now);
    res.status(201).json(session);
  });

  router.get("/sessions/:sessionId", (req, res) => {
    const session = db.getSession(req.params.sessionId);
    if (!session) {
      return res.status(404).json({ error: "找不到这次训练。" });
    }

    res.json({
      session,
      persona: db.getPersona(session.personaId),
      messages: db.listMessages(session.id),
      review: db.getReview(session.id)
    });
  });

  router.post("/sessions/:sessionId/messages", async (req, res) => {
    const content = String(req.body?.content ?? "").trim();
    if (!content) {
      return res.status(400).json({ error: "不能发送空消息。" });
    }

    const session = db.getSession(req.params.sessionId);
    if (!session) {
      return res.status(404).json({ error: "找不到这次训练。" });
    }

    const persona = db.getPersona(session.personaId);
    if (!persona) {
      return res.status(404).json({ error: "找不到这个模拟对象。" });
    }

    const now = new Date().toISOString();
    const userMessage = { id: randomUUID(), sessionId: session.id, role: "user" as const, content, createdAt: now };
    db.addMessage(userMessage);

    try {
      const messages = db.listMessages(session.id).slice(-12);
      const result = await ai.completeChat(buildChatPrompt(persona, messages, session.currentState, session.goal));
      const nextState = applyDelta(session.currentState, result.state_delta);
      const reply = {
        id: randomUUID(),
        sessionId: session.id,
        role: "persona" as const,
        content: result.reply,
        createdAt: new Date().toISOString()
      };

      db.addMessage(reply);
      db.updateSessionState(session.id, nextState, "active", reply.createdAt);
      db.addStateHistory(session.id, nextState, result.state_reason, reply.createdAt);

      res.json({
        userMessage,
        reply,
        session: { ...session, currentState: nextState, updatedAt: reply.createdAt },
        stateReason: result.state_reason,
        boundaryFlags: result.boundary_flags
      });
    } catch (error) {
      res.status(502).json({ error: error instanceof Error ? error.message : "AI 回复失败，请重试。" });
    }
  });

  router.post("/sessions/:sessionId/hint", async (req, res) => {
    const session = db.getSession(req.params.sessionId);
    if (!session) {
      return res.status(404).json({ error: "找不到这次训练。" });
    }

    const persona = db.getPersona(session.personaId);
    if (!persona) {
      return res.status(404).json({ error: "找不到这个模拟对象。" });
    }

    try {
      const messages = db.listMessages(session.id).slice(-12);
      const result = await ai.completeHint(buildHintPrompt(persona, messages, session.currentState, session.goal));
      res.json(result);
    } catch (error) {
      res.status(502).json({ error: error instanceof Error ? error.message : "提示生成失败，请重试。" });
    }
  });

  router.post("/sessions/:sessionId/review", async (req, res) => {
    const session = db.getSession(req.params.sessionId);
    if (!session) {
      return res.status(404).json({ error: "找不到这次训练。" });
    }

    const persona = db.getPersona(session.personaId);
    if (!persona) {
      return res.status(404).json({ error: "找不到这个模拟对象。" });
    }

    try {
      const messages = db.listMessages(session.id);
      const history = db.listStateHistory(session.id);
      const review = await ai.completeReview(buildReviewPrompt(persona, messages, history, session.goal));
      const now = new Date().toISOString();
      db.saveReview(session.id, review, now);
      db.updateSessionState(session.id, session.currentState, "reviewed", now);
      res.json(review);
    } catch (error) {
      res.status(502).json({ error: error instanceof Error ? error.message : "复盘生成失败，请重试。" });
    }
  });

  return router;
}
```

- [ ] **Step 4: Wire routes into server app**

Replace `src/server/index.ts` with:

```ts
import cors from "cors";
import express from "express";
import { createAiProvider, type AiProvider } from "./ai/provider";
import { loadConfig } from "./config";
import { createDatabase, type AppDatabase } from "./db";
import { createRoutes } from "./routes";

type CreateAppOptions = {
  db: AppDatabase;
  ai: AiProvider;
};

export function createApp({ db, ai }: CreateAppOptions) {
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use("/api", createRoutes(db, ai));
  return app;
}

if (process.env.NODE_ENV !== "test") {
  const config = loadConfig();
  const db = createDatabase(config.databasePath);
  const ai = createAiProvider(config);

  createApp({ db, ai }).listen(config.port, () => {
    console.log(`聊天训练 API 已启动：http://localhost:${config.port}`);
  });
}
```

- [ ] **Step 5: Run route tests**

Run: `npm test -- tests/server/routes.test.ts`

Expected: PASS.

- [ ] **Step 6: Run all server tests**

Run: `npm test -- tests/server`

Expected: PASS.

- [ ] **Step 7: Commit API routes**

```bash
git add src/server/index.ts src/server/routes.ts tests/server/routes.test.ts
git commit -m "feat: add training session api"
```

## Task 7: Frontend API Client and UI Workflow

**Files:**
- Create: `src/client/api.ts`
- Create: `src/client/main.tsx`
- Create: `src/client/App.tsx`
- Create: `src/client/components/PersonaPicker.tsx`
- Create: `src/client/components/ChatScreen.tsx`
- Create: `src/client/components/ReviewScreen.tsx`
- Create: `src/client/styles.css`
- Create: `tests/client/App.test.tsx`

- [ ] **Step 1: Write UI flow test**

Create `tests/client/App.test.tsx`:

```tsx
import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import App from "../../src/client/App";

const persona = {
  id: "slow-sincere",
  name: "林夏",
  archetype: "慢热但真诚的同龄女生",
  age: 25,
  city: "杭州",
  occupation: "产品运营",
  relationshipStage: "普通朋友，刚加微信一周",
  recentContext: "最近工作有点忙。",
  personality: ["慢热"],
  chatStyle: ["回复偏短"],
  interests: ["咖啡"],
  boundaries: ["讨厌查户口"],
  initialState: { comfort: 48, trust: 36, interest: 42, ambiguity: 14, pressure: 18 }
};

describe("App", () => {
  it("selects a persona, chats, gets a hint, and shows review", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/api/personas")) {
        return Response.json([persona]);
      }
      if (url.endsWith("/api/sessions")) {
        return Response.json({ id: "s1", personaId: persona.id, goal: "从普通聊天到更熟悉", status: "active", currentState: persona.initialState, createdAt: "now", updatedAt: "now" }, { status: 201 });
      }
      if (url.endsWith("/messages")) {
        return Response.json({
          reply: { id: "m2", sessionId: "s1", role: "persona", content: "嗯，今天确实有点忙。", createdAt: "now" },
          session: { id: "s1", personaId: persona.id, goal: "从普通聊天到更熟悉", status: "active", currentState: persona.initialState, createdAt: "now", updatedAt: "now" }
        });
      }
      if (url.endsWith("/hint")) {
        return Response.json({ hints: ["先接住她的疲惫。"] });
      }
      if (url.endsWith("/review")) {
        return Response.json({
          summary: "她愿意继续聊，但还没有暧昧基础。",
          scores: {
            comfort: { start: 48, end: 52, reason: "回应自然。" },
            trust: { start: 36, end: 38, reason: "有轻微分享。" },
            interest: { start: 42, end: 43, reason: "话题具体。" },
            ambiguity: { start: 14, end: 14, reason: "没有暧昧推进。" },
            pressure: { start: 18, end: 17, reason: "没有施压。" }
          },
          turning_points: [{ user_message: "辛苦了", impact: "升温", why: "接住情绪。" }],
          better_versions: [{ original: "在干嘛", better: "我刚忙完，你今天是不是也挺满？", why: "先分享自己。" }],
          next_goal: "下次继续练接情绪。"
        });
      }
      return Response.json({ error: "not found" }, { status: 404 });
    }));

    render(<App />);
    await screen.findByText("林夏");

    await userEvent.click(screen.getByRole("button", { name: /选择林夏/ }));
    await screen.findByText(/普通朋友/);

    await userEvent.type(screen.getByLabelText("输入你想发的消息"), "今天是不是挺累的？");
    await userEvent.click(screen.getByRole("button", { name: "发送" }));
    await screen.findByText("嗯，今天确实有点忙。");

    await userEvent.click(screen.getByRole("button", { name: "提示" }));
    await screen.findByText("先接住她的疲惫。");

    await userEvent.click(screen.getByRole("button", { name: "结束并复盘" }));
    await waitFor(() => expect(screen.getByText(/她愿意继续聊/)).toBeInTheDocument());
  });
});
```

- [ ] **Step 2: Run UI test to verify failure**

Run: `npm test -- tests/client/App.test.tsx`

Expected: FAIL because client files do not exist.

- [ ] **Step 3: Create frontend API client**

Create `src/client/api.ts`:

```ts
import type { ChatMessage, Persona, ReviewModelResult, TrainingSession } from "../shared/types";

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    headers: { "content-type": "application/json", ...(options?.headers ?? {}) },
    ...options
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: "请求失败" }));
    throw new Error(String(body.error ?? "请求失败"));
  }

  return response.json() as Promise<T>;
}

export const api = {
  listPersonas: () => request<Persona[]>("/api/personas"),
  createSession: (personaId: string, goal = "从普通聊天到更熟悉") =>
    request<TrainingSession>("/api/sessions", {
      method: "POST",
      body: JSON.stringify({ personaId, goal })
    }),
  sendMessage: (sessionId: string, content: string) =>
    request<{ reply: ChatMessage; session: TrainingSession }>(`/api/sessions/${sessionId}/messages`, {
      method: "POST",
      body: JSON.stringify({ content })
    }),
  getHint: (sessionId: string) =>
    request<{ hints: string[] }>(`/api/sessions/${sessionId}/hint`, {
      method: "POST"
    }),
  createReview: (sessionId: string) =>
    request<ReviewModelResult>(`/api/sessions/${sessionId}/review`, {
      method: "POST"
    })
};
```

- [ ] **Step 4: Create React entry**

Create `src/client/main.tsx`:

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

- [ ] **Step 5: Create main app component**

Create `src/client/App.tsx`:

```tsx
import { useEffect, useState } from "react";
import { api } from "./api";
import { ChatScreen } from "./components/ChatScreen";
import { PersonaPicker } from "./components/PersonaPicker";
import { ReviewScreen } from "./components/ReviewScreen";
import type { ChatMessage, Persona, ReviewModelResult, TrainingSession } from "../shared/types";

type Screen = "pick" | "chat" | "review";

export default function App() {
  const [screen, setScreen] = useState<Screen>("pick");
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [selectedPersona, setSelectedPersona] = useState<Persona | null>(null);
  const [session, setSession] = useState<TrainingSession | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [hints, setHints] = useState<string[]>([]);
  const [review, setReview] = useState<ReviewModelResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.listPersonas().then(setPersonas).catch((err) => setError(err.message));
  }, []);

  async function choosePersona(persona: Persona) {
    setLoading(true);
    setError("");
    try {
      const nextSession = await api.createSession(persona.id);
      setSelectedPersona(persona);
      setSession(nextSession);
      setMessages([]);
      setHints([]);
      setScreen("chat");
    } catch (err) {
      setError(err instanceof Error ? err.message : "创建训练失败");
    } finally {
      setLoading(false);
    }
  }

  async function sendMessage(content: string) {
    if (!session) return;
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      sessionId: session.id,
      role: "user",
      content,
      createdAt: new Date().toISOString()
    };
    setMessages((current) => [...current, userMessage]);
    setLoading(true);
    setError("");
    try {
      const result = await api.sendMessage(session.id, content);
      setSession(result.session);
      setMessages((current) => [...current, result.reply]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "发送失败，请重试");
    } finally {
      setLoading(false);
    }
  }

  async function requestHint() {
    if (!session) return;
    setLoading(true);
    setError("");
    try {
      const result = await api.getHint(session.id);
      setHints(result.hints);
    } catch (err) {
      setError(err instanceof Error ? err.message : "提示生成失败");
    } finally {
      setLoading(false);
    }
  }

  async function endAndReview() {
    if (!session) return;
    setLoading(true);
    setError("");
    try {
      const result = await api.createReview(session.id);
      setReview(result);
      setScreen("review");
    } catch (err) {
      setError(err instanceof Error ? err.message : "复盘生成失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="app-shell">
      {error ? <div className="error-banner">{error}</div> : null}
      {screen === "pick" ? <PersonaPicker personas={personas} loading={loading} onChoose={choosePersona} /> : null}
      {screen === "chat" && selectedPersona && session ? (
        <ChatScreen
          persona={selectedPersona}
          messages={messages}
          hints={hints}
          loading={loading}
          onSend={sendMessage}
          onHint={requestHint}
          onReview={endAndReview}
        />
      ) : null}
      {screen === "review" && review ? <ReviewScreen review={review} onRestart={() => setScreen("pick")} /> : null}
    </main>
  );
}
```

- [ ] **Step 6: Create UI components**

Create `src/client/components/PersonaPicker.tsx`:

```tsx
import type { Persona } from "../../shared/types";

type Props = {
  personas: Persona[];
  loading: boolean;
  onChoose: (persona: Persona) => void;
};

export function PersonaPicker({ personas, loading, onChoose }: Props) {
  return (
    <section className="screen">
      <header className="page-header">
        <h1>聊天训练</h1>
        <p>选择一个模拟对象，练习从普通聊天到更熟悉。</p>
      </header>
      <div className="persona-grid">
        {personas.map((persona) => (
          <article className="persona-card" key={persona.id}>
            <h2>{persona.name}</h2>
            <p className="muted">{persona.archetype}</p>
            <p>{persona.relationshipStage}</p>
            <p className="context">{persona.recentContext}</p>
            <button disabled={loading} onClick={() => onChoose(persona)} aria-label={`选择${persona.name}`}>
              选择
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
```

Create `src/client/components/ChatScreen.tsx`:

```tsx
import { FormEvent, useState } from "react";
import type { ChatMessage, Persona } from "../../shared/types";

type Props = {
  persona: Persona;
  messages: ChatMessage[];
  hints: string[];
  loading: boolean;
  onSend: (content: string) => void;
  onHint: () => void;
  onReview: () => void;
};

export function ChatScreen({ persona, messages, hints, loading, onSend, onHint, onReview }: Props) {
  const [draft, setDraft] = useState("");

  function submit(event: FormEvent) {
    event.preventDefault();
    const content = draft.trim();
    if (!content) return;
    setDraft("");
    onSend(content);
  }

  return (
    <section className="phone-shell">
      <header className="chat-header">
        <div>
          <h1>{persona.name}</h1>
          <p>{persona.relationshipStage}</p>
        </div>
        <button onClick={onReview} disabled={loading}>结束并复盘</button>
      </header>
      <div className="context-strip">{persona.recentContext}</div>
      <div className="message-list">
        {messages.map((message) => (
          <div className={`message-row ${message.role === "user" ? "mine" : "theirs"}`} key={message.id}>
            <div className="bubble">{message.content}</div>
          </div>
        ))}
        {loading ? <div className="typing">正在生成...</div> : null}
      </div>
      {hints.length ? (
        <aside className="hint-panel">
          {hints.map((hint) => <p key={hint}>{hint}</p>)}
        </aside>
      ) : null}
      <form className="composer" onSubmit={submit}>
        <button type="button" onClick={onHint} disabled={loading}>提示</button>
        <input value={draft} onChange={(event) => setDraft(event.target.value)} aria-label="输入你想发的消息" />
        <button type="submit" disabled={loading || !draft.trim()}>发送</button>
      </form>
    </section>
  );
}
```

Create `src/client/components/ReviewScreen.tsx`:

```tsx
import type { ReviewModelResult } from "../../shared/types";

type Props = {
  review: ReviewModelResult;
  onRestart: () => void;
};

const scoreLabels = {
  comfort: "舒适度",
  trust: "信任感",
  interest: "兴趣感",
  ambiguity: "暧昧感",
  pressure: "压迫感"
};

export function ReviewScreen({ review, onRestart }: Props) {
  return (
    <section className="screen review">
      <header className="page-header">
        <h1>本轮复盘</h1>
        <p>{review.summary}</p>
      </header>
      <div className="score-grid">
        {Object.entries(review.scores).map(([key, score]) => (
          <article className="score-card" key={key}>
            <strong>{scoreLabels[key as keyof typeof scoreLabels]}</strong>
            <span>{score.start} → {score.end}</span>
            <p>{score.reason}</p>
          </article>
        ))}
      </div>
      <h2>关键转折</h2>
      {review.turning_points.map((point) => (
        <article className="review-block" key={`${point.user_message}-${point.impact}`}>
          <strong>{point.impact}</strong>
          <p>{point.user_message}</p>
          <p>{point.why}</p>
        </article>
      ))}
      <h2>更好的说法</h2>
      {review.better_versions.map((item) => (
        <article className="review-block" key={`${item.original}-${item.better}`}>
          <p>原句：{item.original}</p>
          <p>可以改成：{item.better}</p>
          <p>{item.why}</p>
        </article>
      ))}
      <h2>下一轮目标</h2>
      <p>{review.next_goal}</p>
      <button onClick={onRestart}>再练一局</button>
    </section>
  );
}
```

- [ ] **Step 7: Create styles**

Create `src/client/styles.css`:

```css
* {
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family: "Microsoft YaHei", "PingFang SC", system-ui, sans-serif;
  background: #eef1f4;
  color: #1f2933;
}

button {
  border: 0;
  border-radius: 6px;
  background: #1f7a5c;
  color: white;
  padding: 10px 14px;
  cursor: pointer;
  font: inherit;
}

button:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.app-shell {
  min-height: 100vh;
}

.screen {
  width: min(1100px, calc(100% - 32px));
  margin: 0 auto;
  padding: 32px 0;
}

.page-header h1 {
  margin: 0 0 8px;
  font-size: 32px;
}

.page-header p,
.muted {
  color: #64717d;
}

.persona-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 16px;
}

.persona-card,
.score-card,
.review-block {
  background: white;
  border: 1px solid #d8dee4;
  border-radius: 8px;
  padding: 16px;
}

.context {
  min-height: 48px;
}

.phone-shell {
  width: min(720px, 100%);
  min-height: 100vh;
  margin: 0 auto;
  background: #f7f7f7;
  display: flex;
  flex-direction: column;
}

.chat-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 16px;
  background: #ededed;
  border-bottom: 1px solid #d9d9d9;
}

.chat-header h1 {
  margin: 0;
  font-size: 18px;
}

.chat-header p {
  margin: 4px 0 0;
  color: #6b7280;
  font-size: 13px;
}

.context-strip {
  padding: 10px 16px;
  background: #fff8e6;
  color: #6f5600;
  font-size: 14px;
}

.message-list {
  flex: 1;
  padding: 18px 14px;
  overflow-y: auto;
}

.message-row {
  display: flex;
  margin-bottom: 12px;
}

.message-row.mine {
  justify-content: flex-end;
}

.bubble {
  max-width: min(76%, 460px);
  padding: 10px 12px;
  border-radius: 8px;
  line-height: 1.5;
  background: white;
  border: 1px solid #e5e7eb;
}

.mine .bubble {
  background: #95ec69;
  border-color: #8dde60;
}

.typing {
  color: #6b7280;
  font-size: 14px;
}

.hint-panel {
  margin: 0 12px 10px;
  padding: 10px 12px;
  border-radius: 8px;
  background: #e7f1ff;
  color: #1f4e79;
}

.hint-panel p {
  margin: 6px 0;
}

.composer {
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 8px;
  padding: 12px;
  background: #ededed;
}

.composer input {
  border: 1px solid #d1d5db;
  border-radius: 6px;
  padding: 10px;
  font: inherit;
}

.error-banner {
  background: #ffe4e6;
  color: #9f1239;
  padding: 12px 16px;
}

.score-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
  margin: 20px 0;
}

.score-card span {
  display: block;
  font-size: 24px;
  margin: 8px 0;
}
```

- [ ] **Step 8: Run UI test**

Run: `npm test -- tests/client/App.test.tsx`

Expected: PASS.

- [ ] **Step 9: Commit frontend workflow**

```bash
git add src/client tests/client
git commit -m "feat: add chat training frontend"
```

## Task 8: README, Manual QA, and Final Verification

**Files:**
- Create: `README.md`
- Modify: files only if verification reveals a concrete defect.

- [ ] **Step 1: Create README**

Create `README.md`:

```md
# 聊天训练

本项目是一个本地可用的中文微信语境聊天训练 MVP。它面向 20 多岁、不太会和异性或女性朋友自然建立关系的单身男性，训练从普通聊天到更熟悉、再到轻微暧昧的能力。

## 本地启动

1. 安装依赖：

```bash
npm install
```

2. 创建本地环境变量：

```bash
copy .env.example .env
```

3. 编辑 `.env`，填入可用的大模型 API Key。

4. 启动前后端：

```bash
npm run dev:all
```

前端地址：http://localhost:5173  
后端地址：http://localhost:8787

## 测试

```bash
npm test
npm run typecheck
npm run build
```

## 产品边界

本产品用于训练健康关系能力：表达、倾听、情绪回应、边界感和自然推进。它不能用于操控、施压、骚扰、PUA 或无视拒绝。
```

- [ ] **Step 2: Run full automated checks**

Run: `npm test`

Expected: PASS.

Run: `npm run typecheck`

Expected: PASS.

Run: `npm run build`

Expected: PASS.

- [ ] **Step 3: Start local app**

Run: `npm run dev:all`

Expected:

- Backend prints `聊天训练 API 已启动：http://localhost:8787`.
- Vite prints a local URL at `http://localhost:5173`.

- [ ] **Step 4: Manual QA in browser**

Open `http://localhost:5173` and verify:

- Persona picker shows 5 Chinese persona cards.
- Selecting a persona enters the chat screen.
- Sending a Chinese message creates a user bubble and an AI persona bubble.
- Clicking `提示` shows 2-3 Chinese direction hints.
- Clicking `结束并复盘` shows the review screen.
- Review contains summary, 5 score cards, turning points, better versions, and next goal.
- Relationship scores are not visible during the chat.
- Error banner appears if API key is missing or model call fails.

- [ ] **Step 5: Commit documentation and fixes**

```bash
git add README.md
git commit -m "docs: add local setup guide"
```

## Self-Review

- Spec coverage: The plan covers Chinese personas, free chat, hidden state, optional hints, structured review, SQLite persistence, model API integration, error handling, and local verification.
- Scope check: The MVP is cohesive and can be implemented as one local app plan; login, payment, deployment, native app, media messages, and full WeChat cloning remain outside scope.
- Type consistency: `Persona`, `TrainingSession`, `ChatMessage`, `RelationshipState`, `ChatModelResult`, `HintResult`, and `ReviewModelResult` are defined once in `src/shared/types.ts` and reused across server, client, and tests.
- Red-flag scan: The plan contains no unresolved markers or unspecified implementation steps.
