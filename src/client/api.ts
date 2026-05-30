import type { DistilledPersona, TrainingSession, ChatMessage, DebriefReport, DebriefSession, SessionSummary, PatternDiscovery, ActionAnchor } from '../shared/types';

const BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8787';

async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(BASE + path, { headers: { 'Content-Type': 'application/json' }, ...options });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? '请求失败');
  }
  return res.json();
}

export const client = {
  getPersonas: () => api<DistilledPersona[]>('/api/personas'),

  getPersonaSessions: (personaId: string) =>
    api<SessionSummary[]>('/api/personas/' + personaId + '/sessions'),

  createSession: (personaId: string) =>
    api<TrainingSession>('/api/sessions', { method: 'POST', body: JSON.stringify({ personaId }) }),

  getSession: (sessionId: string) =>
    api<TrainingSession>('/api/sessions/' + sessionId),

  sendMessage: (sessionId: string, content: string) =>
    api<{ userMessage: ChatMessage; message: ChatMessage }>(
      '/api/sessions/' + sessionId + '/messages', { method: 'POST', body: JSON.stringify({ content }) },
    ),

  getMessages: (sessionId: string) =>
    api<ChatMessage[]>('/api/sessions/' + sessionId + '/messages'),

  runReview: (sessionId: string) =>
    api<DebriefReport>('/api/sessions/' + sessionId + '/review', { method: 'POST' }),

  getReview: (sessionId: string) =>
    api<DebriefReport>('/api/sessions/' + sessionId + '/review'),

  getDebrief: (sessionId: string) =>
    api<DebriefSession>('/api/sessions/' + sessionId + '/debrief'),

  submitDebriefAnswer: (sessionId: string, kmId: number, answer: string) =>
    api<{ success: true }>('/api/sessions/' + sessionId + '/debrief/answer', {
      method: 'POST', body: JSON.stringify({ km_id: kmId, answer }),
    }),

  skipDebriefMoment: (sessionId: string, kmId: number) =>
    api<{ success: true }>('/api/sessions/' + sessionId + '/debrief/skip', {
      method: 'POST', body: JSON.stringify({ km_id: kmId }),
    }),

  completeDebrief: (sessionId: string) =>
    api<{ success: true; pattern_discovery?: PatternDiscovery }>(
      '/api/sessions/' + sessionId + '/debrief/complete', { method: 'POST' },
    ),

  // CHG-1：行动锚点
  saveActionAnchor: (sessionId: string, content: string | null) =>
    api<{ success: true; action_anchor: ActionAnchor | null }>(
      '/api/sessions/' + sessionId + '/debrief/anchor', {
        method: 'POST', body: JSON.stringify({ content }),
      },
    ),

  // CHG-2：回溯追踪
  getPreviousAnchor: (sessionId: string) =>
    api<{ anchor: ActionAnchor | null }>(
      '/api/sessions/' + sessionId + '/debrief/previous-anchor',
    ),

  trackPreviousAnchor: (sessionId: string, outcome: string) =>
    api<{ success: true }>(
      '/api/sessions/' + sessionId + '/debrief/anchor/track', {
        method: 'POST', body: JSON.stringify({ outcome }),
      },
    ),

  getLastAnchor: (sessionId: string) =>
    api<{ anchor: ActionAnchor | null }>(
      '/api/sessions/' + sessionId + '/last-anchor',
    ),

  getGrowth: (personaId: string) =>
    api<{ relationship_state: { current_stage: string; current_temperature: string; resonance_score: number; resonance_level: string } }>(
      '/api/personas/' + personaId + '/growth',
    ),

  clonePersona: (personaId: string) =>
    api<DistilledPersona>('/api/personas/' + personaId + '/clone', { method: 'POST' }),

  deleteSession: (sessionId: string) =>
    api<{ success: true }>('/api/sessions/' + sessionId, { method: 'DELETE' }),

  deletePersona: (personaId: string) =>
    api<{ success: true }>('/api/personas/' + personaId, { method: 'DELETE' }),
};
