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

  -- app/people-roster: a recurring "who comes to tagayan" roster, separate
  -- from participants. A participants row is still this *session's* own
  -- name copy (so an old session reads correctly even if someone's roster
  -- name later changes) — person_id (added via migration below, since this
  -- table predates it) is just a forward-looking link for autocomplete and
  -- a future cross-session leaderboard (TASKS.md's Tagay King/Queen, part B).
  CREATE TABLE IF NOT EXISTS people (
    id TEXT PRIMARY KEY,
    device_id TEXT,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL,
    last_used_at TEXT NOT NULL,
    synced INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES sessions(id),
    participant_id TEXT NOT NULL REFERENCES participants(id),
    type TEXT NOT NULL,
    volume TEXT,
    note TEXT,
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
  await migrateAddEventVolume()
  await migrateAddEventNote()
  await migrateAddParticipantPersonId()
  await migrateAddPersonDeviceId()
  await migrateAddPersonNameParts()
  return db
}

/** True if `table` already has a column named `column`, via SQLite's
 * `PRAGMA table_info`. Used so the migrations below check first and only
 * `ALTER TABLE` when the column is actually missing, instead of firing the
 * ALTER unconditionally and swallowing a "duplicate column" error — on web,
 * jeep-sqlite's rejection for that error landed as an unhandled promise
 * rejection in the console even though it was caught, which made every
 * dev-mode remount (React StrictMode re-running initDatabase) log a wall of
 * scary-looking errors for a no-op. Checking first means the ALTER is only
 * ever run once, so there's nothing to swallow. */
async function columnExists(table, column) {
  const result = await db.query(`PRAGMA table_info(${table})`)
  const rows = result.values ?? []
  return rows.some((row) => row.name === column)
}

/**
 * app/session-naming: adds `sessions.name` for installs that already created
 * the table before this column existed (the SCHEMA's `CREATE TABLE IF NOT
 * EXISTS` above only applies to brand-new tables). Safe to call every start
 * — checks via `columnExists` first, so the `ALTER TABLE` only runs once.
 */
async function migrateAddSessionName() {
  if (await columnExists('sessions', 'name')) return
  await db.execute('ALTER TABLE sessions ADD COLUMN name TEXT')
}

/** Session log / pour-volume breakdown: adds `events.volume` (one of
 * usePourVolume.js's POUR_VOLUMES ids, or NULL for a PASS row) for installs
 * whose `events` table predates this column. Same idempotent pattern as
 * migrateAddSessionName above. */
async function migrateAddEventVolume() {
  if (await columnExists('events', 'volume')) return
  await db.execute('ALTER TABLE events ADD COLUMN volume TEXT')
}

/** app/pause-reason-tag: adds `events.note` — a free-ish text slot, used
 * right now for the reason tag on a PAUSE event (e.g. "Drunk", "Takas")
 * so it survives in the DB even if the person is never Resumed before the
 * session ends. Same idempotent pattern as the other migrations above. */
async function migrateAddEventNote() {
  if (await columnExists('events', 'note')) return
  await db.execute('ALTER TABLE events ADD COLUMN note TEXT')
}

/** app/people-roster: adds `participants.person_id` — nullable, no FK
 * enforcement needed (SQLite doesn't enforce FKs by default here, and a
 * dangling reference after a person is deleted from the roster is harmless,
 * see peopleQueries.deletePerson). Same idempotent pattern as the other
 * migrations above. */
async function migrateAddParticipantPersonId() {
  if (await columnExists('participants', 'person_id')) return
  await db.execute('ALTER TABLE participants ADD COLUMN person_id TEXT')
}

/** backend/people-sync: adds `people.device_id` — stamped at push time
 * (same convention as `sessions.device_id`: left null until a row actually
 * syncs, so this column needs to exist for installs that created `people`
 * before this one did, i.e. anyone who used the roster before Supabase sync
 * was wired up for it). Same idempotent pattern as the other migrations. */
async function migrateAddPersonDeviceId() {
  if (await columnExists('people', 'device_id')) return
  await db.execute('ALTER TABLE people ADD COLUMN device_id TEXT')
}

/** app/participant-first-last-name: adds `people.first_name`/`last_name` so
 * the roster can store a split name instead of one opaque string. Existing
 * rows that predate this (first_name still NULL) are backfilled by treating
 * the whole existing `name` as the first name, last name left blank — see
 * DECISIONS.md. `name` itself is kept as a derived "First Last" cache,
 * recomputed by findOrCreatePerson/renamePerson, so every other read site
 * (sync, autocomplete, display) that already expects a single `name` string
 * keeps working unchanged. */
async function migrateAddPersonNameParts() {
  if (!(await columnExists('people', 'first_name'))) {
    await db.execute('ALTER TABLE people ADD COLUMN first_name TEXT')
  }
  if (!(await columnExists('people', 'last_name'))) {
    await db.execute('ALTER TABLE people ADD COLUMN last_name TEXT')
  }
  await db.execute('UPDATE people SET first_name = name WHERE first_name IS NULL')
}

/** Returns the open connection. Throws if `initDatabase()` hasn't run yet. */
export function getDatabase() {
  if (!db) throw new Error('Database not initialized — call initDatabase() first')
  return db
}
