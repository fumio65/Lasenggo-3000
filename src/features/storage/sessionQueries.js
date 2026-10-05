import { getDatabase } from './db'

/**
 * Read/write helpers for the schema set up in `app/sqlite-schema`.
 *
 * Scope note: `device_id` is left null for now — anonymous auth
 * (`backend/anonymous-auth`) doesn't exist yet, so there's no stable device
 * identity to stamp rows with. Every row's `synced`/`synced_at` starts
 * unsynced; actually pushing to Supabase is `backend/sync-job`.
 */

/** Creates a session row and a participant row per participant, in one
 * transaction. Returns the new session id. Participant ids are kept as-is
 * (from `useParticipants`) so UI state and stored rows share the same id. */
export async function createSession(participants) {
  const db = getDatabase()
  const sessionId = crypto.randomUUID()
  const startedAt = new Date().toISOString()

  const set = [
    {
      statement: 'INSERT INTO sessions (id, device_id, started_at, ended_at, synced_at) VALUES (?, NULL, ?, NULL, NULL)',
      values: [sessionId, startedAt],
    },
    ...participants.map((p) => ({
      statement: 'INSERT INTO participants (id, session_id, name, synced) VALUES (?, ?, ?, 0)',
      values: [p.id, sessionId, p.name],
    })),
  ]

  await db.executeSet(set, true)
  return sessionId
}

/** Logs one POUR/PASS event row for the given session + participant. */
export async function logEvent(sessionId, participantId, type) {
  const db = getDatabase()
  await db.run(
    'INSERT INTO events (id, session_id, participant_id, type, timestamp, synced) VALUES (?, ?, ?, ?, ?, 0)',
    [crypto.randomUUID(), sessionId, participantId, type, new Date().toISOString()],
    false,
  )
}

/** Marks a session as ended (used when exiting back to the participant list). */
export async function endSession(sessionId) {
  const db = getDatabase()
  await db.run(
    'UPDATE sessions SET ended_at = ? WHERE id = ?',
    [new Date().toISOString(), sessionId],
    false,
  )
}

/** Temporary debug helper (see ActiveSessionScreen) — counts events logged
 * for a session so persistence can be eyeballed before app/history-list
 * exists to show it properly. Safe to delete once that task lands. */
export async function countEvents(sessionId) {
  const db = getDatabase()
  const result = await db.query('SELECT COUNT(*) as count FROM events WHERE session_id = ?', [sessionId])
  return result.values?.[0]?.count ?? 0
}
