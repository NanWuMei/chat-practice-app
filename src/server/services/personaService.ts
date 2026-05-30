import db from '../db';
import type { DistilledPersona } from '../../shared/types';

export function getAllPersonas(): DistilledPersona[] {
  const rows = db.prepare('SELECT data FROM personas').all() as { data: string }[];
  return rows.map((r) => JSON.parse(r.data) as DistilledPersona);
}

export function getPersona(id: string): DistilledPersona | null {
  const row = db.prepare('SELECT data FROM personas WHERE id = ?').get(id) as { data: string } | undefined;
  return row ? JSON.parse(row.data) as DistilledPersona : null;
}

export function savePersona(persona: DistilledPersona): void {
  db.prepare('INSERT INTO personas (id, data, updated_at) VALUES (?, ?, datetime(\'now\')) ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at').run(persona.id, JSON.stringify(persona));
}

export function deletePersona(id: string): boolean {
  const result = db.prepare('DELETE FROM personas WHERE id = ?').run(id);
  return result.changes > 0;
}

export function clonePersona(sourceId: string): DistilledPersona | null {
  const original = getPersona(sourceId);
  if (!original) return null;

  const cloneId = sourceId + '-clone-' + Date.now();
  const now = new Date().toISOString();
  const clone: DistilledPersona = {
    ...original,
    id: cloneId,
    name: original.name + '（分身）',
    known_patterns: [],
    communication: {
      ...original.communication,
      avg_message_length_baseline: 0,
    },
    meta: {
      created: now,
      last_updated: now,
      session_count: 0,
    },
  };
  savePersona(clone);
  return clone;
}
