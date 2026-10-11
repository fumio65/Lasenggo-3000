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
 * stored as NULL so history can fall back to showing the date instead.
 * app/people-roster: each participant's `person_id` (resolved up front by
 * the caller via `findOrCreatePerson`, since that needs its own query per
 * name) rides along in the same INSERT — nullable, so this still works for
 * any participant object that doesn't carry one. */
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
      statement: 'INSERT INTO participants (id, session_id, name, person_id, synced) VALUES (?, ?, ?, ?, 0)',
      values: [p.id, sessionId, p.name, p.personId ?? null],
    })),
  ]

  await db.executeSet(set, true)
  return sessionId
}

/** Logs one event row for the given session + participant — POUR/PASS
 * (app/local-event-logging), or PAUSE/RESUME (app/pause-reason-tag).
 * `note` is the pause reason tag ("Drunk", "Takas", ...) for a PAUSE row;
 * NULL for everything else. Returns the new row's id so a caller can later
 * target it precisely (app/undo-last-action uses this to undo exactly the
 * event it logged, not just "the most recent row" by time, which could
 * race). */
export async function logEvent(sessionId, participantId, type, volume = null, note = null) {
  const db = getDatabase()
  const id = crypto.randomUUID()
  await db.run(
    'INSERT INTO events (id, session_id, participant_id, type, volume, note, timestamp, synced) VALUES (?, ?, ?, ?, ?, ?, ?, 0)',
    [id, sessionId, participantId, type, volume, note, new Date().toISOString()],
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

/** Inserts a participant row for someone who joins an already-running
 * session (app/add-participant-mid-session) — the same shape createSession
 * inserts per-participant, just one row at a time instead of a whole set,
 * since the session already exists. `personId` (app/people-roster) is
 * optional, same as createSession above. */
export async function addSessionParticipant(sessionId, participantId, name, personId = null) {
  const db = getDatabase()
  await db.run(
    'INSERT INTO participants (id, session_id, name, person_id, synced) VALUES (?, ?, ?, ?, 0)',
    [participantId, sessionId, name, personId],
    false,
  )
}

/** Renames a participant row (app/edit-participant-name) — a straight
 * UPDATE by id, which is already the single row for this person (the
 * `participants` table has one row per id, inserted once in createSession),
 * so there's nothing to fan out: fixing it here is already fixing it
 * everywhere that id is looked up. */
export async function renameParticipant(participantId, name) {
  const db = getDatabase()
  await db.run('UPDATE participants SET name = ? WHERE id = ?', [name, participantId], false)
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

/** Every event for the *current* session, newest first, with the
 * participant's name and the pour volume (for POUR rows; NULL for PASS)
 * joined in — backs the "session log" panel on ActiveSessionScreen: both
 * its per-participant Light/Standard/Heavy/mL breakdown and the recent
 * activity list. Not capped — a casual session's event count is small
 * enough that aggregating client-side from the full list is simpler (and
 * more honest) than maintaining a second, separately-capped query. */
export async function getSessionEvents(sessionId) {
  const db = getDatabase()
  const result = await db.query(
    `SELECT e.id, e.type, e.volume, e.note, e.timestamp, e.participant_id, p.name as participant_name
     FROM events e
     JOIN participants p ON p.id = e.participant_id
     WHERE e.session_id = ?
     ORDER BY e.timestamp DESC`,
    [sessionId],
  )
  return result.values ?? []
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

/** One session's participants with their POUR/PASS counts for that session
 * — including the Light/Standard/Heavy breakdown of their pours, not just
 * the total — in the order they were added (turn order). Used by
 * `app/history-detail`; the volume breakdown backs the same ParticipantStatBar
 * visualization ActiveSessionScreen's live SessionLog uses, so a past
 * session reads the same way a live one does. */
export async function getSessionDetail(sessionId) {
  const db = getDatabase()
  const sessionResult = await db.query('SELECT * FROM sessions WHERE id = ?', [sessionId])
  const session = sessionResult.values?.[0] ?? null

  const participantsResult = await db.query(
    `SELECT
       p.id, p.name,
       SUM(CASE WHEN e.type = 'POUR' THEN 1 ELSE 0 END) as pour_count,
       SUM(CASE WHEN e.type = 'PASS' THEN 1 ELSE 0 END) as pass_count,
       SUM(CASE WHEN e.type = 'POUR' AND e.volume = 'light' THEN 1 ELSE 0 END) as light_count,
       SUM(CASE WHEN e.type = 'POUR' AND e.volume = 'standard' THEN 1 ELSE 0 END) as standard_count,
       SUM(CASE WHEN e.type = 'POUR' AND e.volume = 'heavy' THEN 1 ELSE 0 END) as heavy_count
     FROM participants p
     LEFT JOIN events e ON e.participant_id = p.id
     WHERE p.session_id = ?
     GROUP BY p.id
     ORDER BY p.rowid`,
    [sessionId],
  )

  return { session, participants: participantsResult.values ?? [] }
}
