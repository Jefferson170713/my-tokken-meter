import fs from 'node:fs'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { pastaDados } from './paths.ts'

export function abrirDb(dir = pastaDados()): DatabaseSync {
  fs.mkdirSync(dir, { recursive: true })
  const db = new DatabaseSync(path.join(dir, 'meter.db'))
  // WAL + busy_timeout: o app e o MCP gravam no mesmo banco ao mesmo tempo
  db.exec('PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 3000;')
  db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      msg_id TEXT NOT NULL,
      req_id TEXT NOT NULL,
      ts INTEGER NOT NULL,
      session_id TEXT,
      project TEXT,
      model TEXT NOT NULL,
      input INTEGER NOT NULL,
      output INTEGER NOT NULL,
      cw5m INTEGER NOT NULL,
      cw1h INTEGER NOT NULL,
      cread INTEGER NOT NULL,
      sidechain INTEGER NOT NULL,
      speed TEXT,
      PRIMARY KEY (msg_id, req_id)
    );
    CREATE INDEX IF NOT EXISTS messages_ts ON messages (ts);
    CREATE TABLE IF NOT EXISTS files (
      path TEXT PRIMARY KEY,
      offset INTEGER NOT NULL,
      ignoradas INTEGER NOT NULL DEFAULT 0
    );
  `)
  return db
}
