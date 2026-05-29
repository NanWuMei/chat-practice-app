import Database from "better-sqlite3";
import * as path from "path";
import * as fs from "fs";
import type { DistilledPersona, TrainingSession, ChatMessage, DualReviewReport } from "../shared/types";

const DATA_DIR = path.join(process.cwd(), "data");
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, "chat.db");
const db = new Database(DB_PATH);

// Enable WAL mode for better concurrent performance
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// ============================================================
// Schema
// ============================================================

db.exec(`
  CREATE TABLE IF NOT EXISTS personas (
    id TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    persona_id TEXT NOT NULL,
    data TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (persona_id) REFERENCES personas(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS reviews (
    session_id TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS persona_memories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    persona_id TEXT NOT NULL,
    data TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (persona_id) REFERENCES personas(id) ON DELETE CASCADE
  );
`);

// ============================================================
// Seed default data
// ============================================================

export function seedDefaultData(defaultPersonas: DistilledPersona[]): void {
  const count = db.prepare("SELECT COUNT(*) as count FROM personas").get() as { count: number };
  if (count.count === 0) {
    const insert = db.prepare("INSERT INTO personas (id, data) VALUES (?, ?)");
    const tx = db.transaction(() => {
      for (const p of defaultPersonas) {
        insert.run(p.id, JSON.stringify(p));
      }
    });
    tx();
    console.log(`初始化了 ${defaultPersonas.length} 个默认角色`);
  }
}

export default db;
