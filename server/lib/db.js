import path from 'path';
import { fileURLToPath } from 'url';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..', '..');

let db;

function resolveDbPath() {
  const raw = process.env.SQLITE_PATH;
  if (!raw) return path.join(projectRoot, 'data.sqlite');
  // If env is a relative path, resolve it against project root for stability.
  return path.isAbsolute(raw) ? raw : path.resolve(projectRoot, raw);
}

export function getDbPath() {
  return resolveDbPath();
}

export async function getDb() {
  if (!db) {
    const dbPath = resolveDbPath();
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });

    console.log(`[wenxing] SQLite path: ${dbPath}`);
  }
  return db;
}

export function initDb() {
  // Fire-and-forget init; routes will await getDb.
  void (async () => {
    const conn = await getDb();
    await conn.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA foreign_keys = ON;

      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        is_pro INTEGER NOT NULL DEFAULT 0,
        ai_quota_total INTEGER NOT NULL DEFAULT 3,
        ai_quota_used INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

    `);
  })();
}
