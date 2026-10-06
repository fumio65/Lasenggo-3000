import { Capacitor } from '@capacitor/core'
import { CapacitorSQLite, SQLiteConnection } from '@capacitor-community/sqlite'

/**
 * Local SQLite setup — schema only (app/sqlite-schema). Reading/writing
 * session/participant/event rows from the UI is `app/local-event-logging`;
 * pushing unsynced rows to Supabase is `backend/sync-job`. This module just
 * owns the connection and makes sure the tables below exist.
 *
 * Schema matches ARCHITECTURE.md's Data Models section. Local SQLite mirrors
 * the Postgres shape plus a per-row `synced` flag (events/participants) or
 * `synced_at` timestamp (sessions, already nullable-until-synced in the
 * shared schema) so the sync job can find what still needs pushing.
 */
const DB_NAME = 'lasenggo3000'

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    device_id TEXT,
    name TEXT,
    started_at TEXT,
    ended_at TEXT,
    synced_at TEXT
  );

  CREATE TABLE IF NOT EXISTS participants (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES sessions(id),
    name TEXT NOT NULL,
    synced INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES sessions(id),
    participant_id TEXT NOT NULL REFERENCES participants(id),
    type TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    synced INTEGER NOT NULL DEFAULT 0
  );
`

const sqlite = new SQLiteConnection(CapacitorSQLite)
let db = null
let webStoreReady = false

/**
 * Opens the local database and applies the schema (idempotent — safe to
 * call on every app start). Returns the open connection.
 */
export async function initDatabase() {
  if (Capacitor.getPlatform() === 'web' && !webStoreReady) {
    await customElements.whenDefined('jeep-sqlite')
    await sqlite.initWebStore()
    webStoreReady = true
  }

  const { result: alreadyOpen } = await sqlite.isConnection(DB_NAME, false)
  db = alreadyOpen
    ? await sqlite.retrieveConnection(DB_NAME, false)
    : await sqlite.createConnection(DB_NAME, false, 'no-encryption', 1, false)

  await db.open()
  await db.execute(SCHEMA)
  await migrateAddSessionName()
  return db
}

/**
 * app/session-naming: adds `sessions.name` for installs that already created
 * the table before this column existed (the SCHEMA's `CREATE TABLE IF NOT
 * EXISTS` above only applies to brand-new tables). Safe to call every start
 * — SQLite has no `ADD COLUMN IF NOT EXISTS`, so a "duplicate column" error
 * means it's already there and is swallowed; any other error rethrows.
 */
async function migrateAddSessionName() {
  try {
    await db.execute('ALTER TABLE sessions ADD COLUMN name TEXT')
  } catch (err) {
    if (!/duplicate column/i.test(err.message ?? '')) throw err
  }
}

/** Returns the open connection. Throws if `initDatabase()` hasn't run yet. */
export function getDatabase() {
  if (!db) throw new Error('Database not initialized — call initDatabase() first')
  return db
}
