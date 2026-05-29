import type { DistilledPersona, MentorCard, TrainingSession, ChatMessage, DualReviewReport, SessionSummary } from "../shared/types";

const BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:8787";

async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { headers: { "Content-Type": "application/json" }, ...options });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? "请求失败");
  }
  return res.json();
}

export const client = {
  getPersonas: () => api<DistilledPersona[]>("/api/personas"),
  getMentors: () => api<MentorCard[]>("/api/mentors"),

  getPersonaSessions: (personaId: string) =>
    api<SessionSummary[]>(`/api/personas/${personaId}/sessions`),

  createSession: (personaId: string) =>
    api<TrainingSession>("/api/sessions", { method: "POST", body: JSON.stringify({ personaId }) }),

  getSession: (sessionId: string) =>
    api<TrainingSession>(`/api/sessions/${sessionId}`),

  sendMessage: (sessionId: string, content: string) =>
    api<{ userMessage: ChatMessage; message: ChatMessage; stateReason: string; boundaryFlags: string[] }>(
      `/api/sessions/${sessionId}/messages`, { method: "POST", body: JSON.stringify({ content }) }
    ),

  getMessages: (sessionId: string) => api<ChatMessage[]>(`/api/sessions/${sessionId}/messages`),

  runReview: (sessionId: string) =>
    api<DualReviewReport>(`/api/sessions/${sessionId}/review`, { method: "POST" }),

  getReview: (sessionId: string) => api<DualReviewReport>(`/api/sessions/${sessionId}/review`),

  clonePersona: (personaId: string) =>
    api<DistilledPersona>(`/api/personas/${personaId}/clone`, { method: "POST" }),

  deleteSession: (sessionId: string) =>
    api<{ success: true }>(`/api/sessions/${sessionId}`, { method: "DELETE" }),

  deletePersona: (personaId: string) =>
    api<{ success: true }>(`/api/personas/${personaId}`, { method: "DELETE" }),
};
