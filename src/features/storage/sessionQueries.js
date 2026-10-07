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
 * (from `useParticipants`) so UI state and stored rows share the same id.
 * `name` is optional (app/session-naming) — a blank/whitespace-only name is
 * stored as NULL so history can fall back to showing the date instead. */
export async function createSession(participants, name = '') {
  const db = getDatabase()
  const sessionId = crypto.randomUUID()
  const startedAt = new Date().toISOString()
  const trimmedName = name.trim() || null

  const set = [
    {
      statement: 'INSERT INTO sessions (id, device_id, name, started_at, ended_at, synced_at) VALUES (?, NULL, ?, ?, NULL, NULL)',
      values: [sessionId, trimmedName, startedAt],
    },
    ...participants.map((p) => ({
      statement: 'INSERT INTO participants (id, session_id, name, synced) VALUES (?, ?, ?, 0)',
      values: [p.id, sessionId, p.name],
    })),
  ]

  await db.executeSet(set, true)
  return sessionId
}

/** Logs one POUR/PASS event row for the given session + participant.
 * Returns the new row's id so a caller can later target it precisely
 * (app/undo-last-action uses this to undo exactly the event it logged, not
 * just "the most recent row" by time, which could race). */
export async function logEvent(sessionId, participantId, type) {
  const db = getDatabase()
  const id = crypto.randomUUID()
  await db.run(
    'INSERT INTO events (id, session_id, participant_id, type, timestamp, synced) VALUES (?, ?, ?, ?, ?, 0)',
    [id, sessionId, participantId, type, new Date().toISOString()],
    false,
  )
  return id
}

/** Deletes one event row by id (app/undo-last-action). Only ever called for
 * an event this device just logged a moment ago in the current session — see
 * that task's notes for the known limitation if it already synced. */
export async function deleteEvent(eventId) {
  const db = getDatabase()
  await db.run('DELETE FROM events WHERE id = ?', [eventId], false)
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

/** Past sessions with participant count, newest first. Used by
 * `app/history-list`. */
export async function getSessionHistory() {
  const db = getDatabase()
  const result = await db.query(`
    SELECT s.id, s.name, s.started_at, s.ended_at, COUNT(p.id) as participant_count
    FROM sessions s
    LEFT JOIN participants p ON p.session_id = s.id
    GROUP BY s.id
    ORDER BY s.started_at DESC
  `)
  return result.values ?? []
}

/** One session's participants with their POUR/PASS counts for that session,
 * in the order they were added (turn order). Used by `app/history-detail`. */
export async function getSessionDetail(sessionId) {
  const db = getDatabase()
  const sessionResult = await db.query('SELECT * FROM sessions WHERE id = ?', [sessionId])
  const session = sessionResult.values?.[0] ?? null

  const participantsResult = await db.query(
    `SELECT
       p.id, p.name,
       SUM(CASE WHEN e.type = 'POUR' THEN 1 ELSE 0 END) as pour_count,
       SUM(CASE WHEN e.type = 'PASS' THEN 1 ELSE 0 END) as pass_count
     FROM participants p
     LEFT JOIN events e ON e.participant_id = p.id
     WHERE p.session_id = ?
     GROUP BY p.id
     ORDER BY p.rowid`,
    [sessionId],
  )

  return { session, participants: participantsResult.values ?? [] }
}
