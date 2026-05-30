import { randomUUID } from 'crypto';
import db from '../db';
import type { TrainingSession, ChatMessage, DebriefReport, DebriefSession } from '../../shared/types';

// ============================================================
// Sessions
// ============================================================

export function getSessionsByPersona(personaId: string): TrainingSession[] {
  const rows = db.prepare('SELECT data FROM sessions WHERE persona_id = ? ORDER BY created_at DESC').all(personaId) as { data: string }[];
  return rows.map((r) => JSON.parse(r.data) as TrainingSession);
}

export function getAllSessions(): TrainingSession[] {
  const rows = db.prepare('SELECT data FROM sessions ORDER BY created_at DESC').all() as { data: string }[];
  return rows.map((r) => JSON.parse(r.data) as TrainingSession);
}

export function getSession(id: string): TrainingSession | null {
  const row = db.prepare('SELECT data FROM sessions WHERE id = ?').get(id) as { data: string } | undefined;
  return row ? JSON.parse(row.data) as TrainingSession : null;
}

export function saveSession(session: TrainingSession): void {
  db.prepare('INSERT INTO sessions (id, persona_id, data, updated_at) VALUES (?, ?, ?, datetime(\'now\')) ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at').run(session.id, session.personaId, JSON.stringify(session));
}

export function deleteSession(id: string): boolean {
  const result = db.prepare('DELETE FROM sessions WHERE id = ?').run(id);
  return result.changes > 0;
}

// ============================================================
// Messages
// ============================================================

export function getMessages(sessionId: string): ChatMessage[] {
  const rows = db.prepare('SELECT id, session_id as sessionId, role, content, created_at as createdAt FROM messages WHERE session_id = ? ORDER BY rowid').all(sessionId) as ChatMessage[];
  return rows;
}

export function saveMessages(sessionId: string, messages: ChatMessage[]): void {
  const deleteStmt = db.prepare('DELETE FROM messages WHERE session_id = ?');
  const insertStmt = db.prepare('INSERT INTO messages (id, session_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)');

  const tx = db.transaction(() => {
    deleteStmt.run(sessionId);
    for (const m of messages) {
      insertStmt.run(m.id, sessionId, m.role, m.content, m.createdAt);
    }
  });
  tx();
}

export function addMessage(sessionId: string, role: ChatMessage['role'], content: string): ChatMessage {
  const msg: ChatMessage = {
    id: randomUUID(),
    sessionId,
    role,
    content,
    createdAt: new Date().toISOString(),
  };
  db.prepare('INSERT INTO messages (id, session_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)').run(
    msg.id, sessionId, role, content, msg.createdAt,
  );
  return msg;
}

// ============================================================
// Reviews（v3.0：DebriefReport）
// ============================================================

export function getReview(sessionId: string): DebriefReport | null {
  const row = db.prepare('SELECT data FROM reviews WHERE session_id = ?').get(sessionId) as { data: string } | undefined;
  return row ? JSON.parse(row.data) as DebriefReport : null;
}

export function saveReview(sessionId: string, review: DebriefReport): void {
  db.prepare('INSERT INTO reviews (session_id, data, created_at) VALUES (?, ?, datetime(\'now\')) ON CONFLICT(session_id) DO UPDATE SET data = excluded.data').run(sessionId, JSON.stringify(review));
}

// ============================================================
// Debrief Sessions（v3.0：存档用）
// ============================================================

export function getDebriefSession(sessionId: string): DebriefSession | null {
  const row = db.prepare('SELECT data FROM debrief_sessions WHERE session_id = ?').get(sessionId) as { data: string } | undefined;
  return row ? JSON.parse(row.data) as DebriefSession : null;
}

export function saveDebriefSession(sessionId: string, debrief: DebriefSession): void {
  db.prepare('INSERT INTO debrief_sessions (session_id, data, created_at) VALUES (?, ?, datetime(\'now\')) ON CONFLICT(session_id) DO UPDATE SET data = excluded.data').run(sessionId, JSON.stringify(debrief));
}
