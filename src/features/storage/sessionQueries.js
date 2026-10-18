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
export async function createSession(participants, name = '', drinkName = '', drinkVolumeMl = null) {
  const db = getDatabase()
  const sessionId = crypto.randomUUID()
  const startedAt = new Date().toISOString()
  const trimmedName = name.trim() || null
  const trimmedDrinkName = drinkName.trim()

  const set = [
    {
      statement: 'INSERT INTO sessions (id, device_id, name, started_at, ended_at, synced_at) VALUES (?, NULL, ?, ?, NULL, NULL)',
      values: [sessionId, trimmedName, startedAt],
    },
    ...participants.map((p) => ({
      statement: 'INSERT INTO participants (id, session_id, name, person_id, synced) VALUES (?, ?, ?, ?, 0)',
      values: [p.id, sessionId, p.name, p.personId ?? null],
    })),
    // app/drink-tracking: the drink/mL fields on "Who's joining" are
    // optional (same as session name/pass limit) — only logged at all if
    // a drink name was actually given.
    ...(trimmedDrinkName
      ? [
          {
            statement:
              "INSERT INTO drinks (id, session_id, name, volume_ml, started_at, status, synced) VALUES (?, ?, ?, ?, ?, 'serving', 0)",
            values: [crypto.randomUUID(), sessionId, trimmedDrinkName, drinkVolumeMl ?? null, startedAt],
          },
        ]
      : []),
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

/** app/drink-tracking (+ app/drink-queue): logs a drink row — called once
 * at Start Session (if a drink was given; see createSession), every time
 * someone taps "Same drink" (a fresh bottle/batch of the same thing), and
 * for both "switch now" and "queue for later" in the UI. `status` is
 * 'serving' for the first three (it's immediately what's being served) and
 * 'queued' for the last (staged ahead of time, not yet active — see
 * db.js's drinks table notes and DECISIONS.md). Queuing a new drink
 * replaces any existing queued one for this session, since only one
 * "what's coming up next" makes sense at a time. Returns the new row's id. */
export async function addDrink(sessionId, name, volumeMl = null, status = 'serving') {
  const db = getDatabase()
  const id = crypto.randomUUID()
  const set = [
    ...(status === 'queued'
      ? [{ statement: "DELETE FROM drinks WHERE session_id = ? AND status = 'queued'", values: [sessionId] }]
      : []),
    {
      statement:
        'INSERT INTO drinks (id, session_id, name, volume_ml, started_at, status, synced) VALUES (?, ?, ?, ?, ?, ?, 0)',
      values: [id, sessionId, name.trim(), volumeMl ?? null, new Date().toISOString(), status],
    },
  ]
  await db.executeSet(set, true)
  return id
}

/** app/drink-queue: promotes a queued drink (see addDrink) to 'serving' —
 * the one-tap confirm once the current drink hits 0 (never automatic, see
 * DECISIONS.md). `started_at` is reset to now rather than kept at queue
 * time, so the depletion math on ActiveSessionScreen starts counting this
 * drink's pours from the moment it actually started being served, not
 * from whenever it happened to be staged. */
export async function promoteQueuedDrink(drinkId) {
  const db = getDatabase()
  await db.run(
    "UPDATE drinks SET status = 'serving', started_at = ? WHERE id = ?",
    [new Date().toISOString(), drinkId],
    false,
  )
}

/** app/drink-queue: drops a queued drink that was never served — a queued
 * row never represents anything that actually happened, so a hard DELETE
 * (not a status change) is the correct "undo" here, same reasoning as
 * deleteEvent's undo. */
export async function cancelQueuedDrink(drinkId) {
  const db = getDatabase()
  await db.run('DELETE FROM drinks WHERE id = ?', [drinkId], false)
}

/** Whatever's being served *right now* for this session — the most
 * recently started 'serving' drink row, or null if none was ever logged
 * (drink tracking is optional). Backs ActiveSessionScreen's "Now serving"
 * row. Filtered to status = 'serving' (app/drink-queue) so a queued row —
 * which can have a later started_at than the row actually being served —
 * never gets picked up as "current" by mistake. */
export async function getCurrentDrink(sessionId) {
  const db = getDatabase()
  const result = await db.query(
    "SELECT id, name, volume_ml, started_at FROM drinks WHERE session_id = ? AND status = 'serving' ORDER BY started_at DESC LIMIT 1",
    [sessionId],
  )
  return result.values?.[0] ?? null
}

/** app/drink-queue: the drink staged to serve next, if any — backs the
 * "Up next" row on ActiveSessionScreen and its one-tap "Switch now"
 * confirm. addDrink only ever leaves one 'queued' row per session (it
 * deletes any existing one first), so this is just that row, or null. */
export async function getQueuedDrink(sessionId) {
  const db = getDatabase()
  const result = await db.query(
    "SELECT id, name, volume_ml, started_at FROM drinks WHERE session_id = ? AND status = 'queued' ORDER BY started_at DESC LIMIT 1",
    [sessionId],
  )
  return result.values?.[0] ?? null
}

/** The full drink log for one session, oldest first — backs
 * `app/history-detail`'s drink-log section, same "show the whole log, not
 * just the latest" idea as getSessionEvents' Activity log. Filtered to
 * status = 'serving' (app/drink-queue) — a queued-but-never-promoted row
 * was never actually served, so it doesn't belong in "what was served". */
export async function getSessionDrinks(sessionId) {
  const db = getDatabase()
  const result = await db.query(
    "SELECT id, name, volume_ml, started_at FROM drinks WHERE session_id = ? AND status = 'serving' ORDER BY started_at ASC",
    [sessionId],
  )
  return result.values ?? []
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
