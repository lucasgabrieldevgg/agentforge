// AgentForge Local — banco SQLite (bun:sqlite, WAL)
import { Database } from "bun:sqlite";
import { chmodSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DB_PATH, ensureDirs } from "./paths";

// garante que o diretório de dados existe ANTES de abrir o banco
// (module top-level roda antes do corpo do entrypoint)
ensureDirs();
mkdirSync(dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH, { create: true });
db.exec("PRAGMA journal_mode = WAL;");
db.exec("PRAGMA busy_timeout = 5000;");
try { chmodSync(DB_PATH, 0o600); } catch {}

db.exec(`
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  goal TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',  -- queued|running|paused|done|failed
  model TEXT,
  iterations INTEGER NOT NULL DEFAULT 0,
  summary TEXT,
  error TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id TEXT,
  role TEXT NOT NULL,                    -- user|assistant|tool
  content TEXT NOT NULL DEFAULT '',
  tool_calls TEXT,                       -- JSON de tool_calls (role assistant)
  tool_call_id TEXT,                     -- para role tool
  name TEXT,                             -- nome da tool (role tool)
  thinking TEXT,
  model TEXT,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id TEXT,
  type TEXT NOT NULL,
  data TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at);
CREATE INDEX IF NOT EXISTS idx_events_job ON events(job_id, id);
`);

export const now = () => Date.now();

// ---------- settings ----------
export function getSetting(key: string): string | undefined {
  const row = db.query("SELECT value FROM settings WHERE key = ?").get(key) as { value: string } | undefined;
  return row?.value;
}
export function setSetting(key: string, value: string): void {
  db.query("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(key, value);
}
export function allSettings(): Record<string, string> {
  // ⚠ Object.fromEntries(rows) direto quebra: rows do bun:sqlite têm props
  // key/value que o ToEntry do JS interpreta como entrada [undefined, undefined].
  const rows = db.query("SELECT key, value FROM settings").all() as { key: string; value: string }[];
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

// ---------- messages ----------
export type MsgRow = {
  id: number; job_id: string | null; role: string; content: string;
  tool_calls: string | null; tool_call_id: string | null; name: string | null;
  thinking: string | null; model: string | null; created_at: number;
};
export function addMessage(m: { job_id?: string; role: string; content?: string; tool_calls?: unknown; tool_call_id?: string; name?: string; thinking?: string; model?: string }): number {
  const r = db.query(`INSERT INTO messages (job_id, role, content, tool_calls, tool_call_id, name, thinking, model, created_at)
    VALUES (?,?,?,?,?,?,?,?,?)`).run(
    m.job_id ?? null, m.role, m.content ?? "", m.tool_calls ? JSON.stringify(m.tool_calls) : null,
    m.tool_call_id ?? null, m.name ?? null, m.thinking ?? null, m.model ?? null, now());
  return Number(r.lastInsertRowid);
}
export function recentMessages(limit = 40): MsgRow[] {
  const rows = db.query("SELECT * FROM messages ORDER BY id DESC LIMIT ?").all(limit) as MsgRow[];
  return rows.reverse();
}
export function allMessages(): MsgRow[] {
  return db.query("SELECT * FROM messages ORDER BY id ASC").all() as MsgRow[];
}

// ---------- jobs ----------
export type JobRow = { id: string; goal: string; status: string; model: string | null; iterations: number; summary: string | null; error: string | null; created_at: number; updated_at: number };
export function createJob(goal: string, model: string): JobRow {
  const id = "job_" + now().toString(36) + Math.random().toString(36).slice(2, 7);
  db.query("INSERT INTO jobs (id, goal, status, model, created_at, updated_at) VALUES (?,?,?,?,?,?)")
    .run(id, goal, "queued", model, now(), now());
  return { id, goal, status: "queued", model, iterations: 0, summary: null, error: null, created_at: now(), updated_at: now() };
}
export function getJob(id: string): JobRow | undefined {
  return db.query("SELECT * FROM jobs WHERE id = ?").get(id) as JobRow | undefined;
}
export function updateJob(id: string, patch: Partial<Pick<JobRow, "status" | "iterations" | "summary" | "error" | "model">>): void {
  const sets: string[] = []; const vals: unknown[] = [];
  for (const [k, v] of Object.entries(patch)) { sets.push(`${k} = ?`); vals.push(v); }
  sets.push("updated_at = ?"); vals.push(now());
  db.query(`UPDATE jobs SET ${sets.join(", ")} WHERE id = ?`).run(...vals, id);
}
export function listJobs(limit = 50): JobRow[] {
  return db.query("SELECT * FROM jobs ORDER BY updated_at DESC LIMIT ?").all(limit) as JobRow[];
}
/** Marca jobs que ficaram 'running' após um crash — para retomar/auditar. */
export function orphanedJobs(): JobRow[] {
  return db.query("SELECT * FROM jobs WHERE status IN ('running','queued')").all() as JobRow[];
}

// ---------- events ----------
export type EventRow = { id: number; job_id: string | null; type: string; data: string; created_at: number };
export function addEvent(jobId: string | null, type: string, data: Record<string, unknown> = {}): EventRow {
  const t = now();
  const r = db.query("INSERT INTO events (job_id, type, data, created_at) VALUES (?,?,?,?)")
    .run(jobId, type, JSON.stringify(data), t);
  return { id: Number(r.lastInsertRowid), job_id: jobId, type, data: JSON.stringify(data), created_at: t };
}
export function jobEvents(jobId: string, afterId = 0): EventRow[] {
  return db.query("SELECT * FROM events WHERE job_id = ? AND id > ? ORDER BY id ASC").all(jobId, afterId) as EventRow[];
}
export function globalEvents(afterId = 0, limit = 200): EventRow[] {
  return db.query("SELECT * FROM events WHERE id > ? ORDER BY id ASC LIMIT ?").all(afterId, limit) as EventRow[];
}

export function clearConversation(): void {
  db.exec("DELETE FROM messages;");
}
