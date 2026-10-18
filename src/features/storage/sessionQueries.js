import { getDatabase } from './db'
import { POUR_VOLUMES } from '../pour/usePourVolume'

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
 * race).
 * `drinkId` (app/drink-switchback) is only meaningful for a POUR row — the
 * drinks row that was actually "Now serving" at the moment this pour
 * happened, so remaining-volume math can later be computed exactly per
 * drink regardless of how many times the session switches back and
 * forth. Left null for PASS/PAUSE/RESUME. */
export async function logEvent(sessionId, participantId, type, volume = null, note = null, drinkId = null) {
  const db = getDatabase()
  const id = crypto.randomUUID()
  await db.run(
    'INSERT INTO events (id, session_id, participant_id, type, volume, note, drink_id, timestamp, synced) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)',
    [id, sessionId, participantId, type, volume, note, drinkId, new Date().toISOString()],
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

/** Internal: maps a POUR event's `volume` id (usePourVolume's
 * light/standard/heavy) to its approximate mL, the same lookup
 * ActiveSessionScreen already does client-side for the live display —
 * kept in sync by importing POUR_VOLUMES from the same source of truth
 * rather than hardcoding the numbers twice. */
function mlForPourVolume(volumeId) {
  return POUR_VOLUMES.find((v) => v.id === volumeId)?.approxMl ?? 0
}

/** Internal: a drink's remaining volume right now — its declared
 * `volumeMl` minus every POUR event tagged with its id (app/drink-
 * switchback's `events.drink_id`), or null if no volume was declared.
 * This is the DB-side equivalent of the same formula ActiveSessionScreen
 * computes client-side from its already-fetched `events` list; this one
 * exists because `demoteCurrentDrink` below needs the number before the
 * UI has necessarily refetched anything. */
async function getRemainingMl(drinkId, volumeMl) {
  if (volumeMl == null) return null
  const db = getDatabase()
  const result = await db.query("SELECT volume FROM events WHERE drink_id = ? AND type = 'POUR'", [
    drinkId,
  ])
  const pouredMl = (result.values ?? []).reduce((sum, e) => sum + mlForPourVolume(e.volume), 0)
  return volumeMl - pouredMl
}

/** Internal: whenever a drink is about to become 'serving' (a fresh
 * addDrink, a queue promotion, or switching back to an older drink —
 * everything funnels through here), whatever was 'serving' before it
 * needs to stop being 'serving' first — otherwise two rows end up marked
 * current at once, with getCurrentDrink's `ORDER BY started_at DESC`
 * only picking the right one by the accident of always being the most
 * recently touched row. app/drink-switchback: what it becomes instead
 * depends on two things — whether it still has alcohol in it (the whole
 * point of the feature: "I can still switch it back since there's still
 * alcohol on it"), and whether the one "Up next" slot is actually free.
 * Still has volume (or none was ever declared, so there's nothing to
 * disprove) AND nothing else is already staged there -> becomes the new
 * "Up next". Either it's empty, or something else already earned that
 * slot (the common case: switching to a *third* drink while an earlier
 * one is already staged — that staged drink was a deliberate choice and
 * must never be silently bumped or deleted just because a different
 * drink is now being left) -> plain history ('served'). 'served' isn't
 * "finished", just "not current, not staged" — getSessionDrinkHistory
 * still surfaces it with its real remaining volume either way, so
 * nothing actually becomes harder to switch back to; it just isn't the
 * one row spotlighted as "Up next". No-op if nothing is currently
 * serving. */
async function demoteCurrentDrink(sessionId, excludeDrinkId = null) {
  const current = await getCurrentDrink(sessionId)
  if (!current) return
  const db = getDatabase()
  const remaining = await getRemainingMl(current.id, current.volume_ml)
  const stillHasVolume = remaining == null || remaining > 0
  // `excludeDrinkId` is switchToDrink's target — when it's the row
  // already sitting in the queue slot (promoting "Up next"), that slot
  // reads as free for this check, since it's about to be vacated anyway.
  const existingQueued = await getQueuedDrink(sessionId)
  const queueSlotTaken =
    existingQueued != null && existingQueued.id !== excludeDrinkId && existingQueued.id !== current.id
  if (stillHasVolume && !queueSlotTaken) {
    await db.run("UPDATE drinks SET status = 'queued' WHERE id = ?", [current.id], false)
  } else {
    await db.run("UPDATE drinks SET status = 'served' WHERE id = ?", [current.id], false)
  }
}

/** app/drink-tracking (+ app/drink-queue): logs a drink row — called once
 * at Start Session (if a drink was given; see createSession), every time
 * someone taps "Same drink" (a fresh bottle/batch of the same thing), and
 * for both "switch now" and "queue for later" in the UI. `status` is
 * 'serving' for the first three (it's immediately what's being served) and
 * 'queued' for the last (staged ahead of time, not yet active — see
 * db.js's drinks table notes and DECISIONS.md). Queuing a new drink
 * replaces any existing queued one for this session, since only one
 * "what's coming up next" makes sense at a time. Inserting a new
 * 'serving' row first demotes whatever was serving before it
 * (demoteCurrentDrink) — this used to not happen at all, which meant the
 * old row silently stayed marked 'serving' forever (see DECISIONS.md).
 * Returns the new row's id. */
export async function addDrink(sessionId, name, volumeMl = null, status = 'serving') {
  const id = crypto.randomUUID()
  if (status === 'serving') {
    await demoteCurrentDrink(sessionId)
  }
  const db = getDatabase()
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

/** app/drink-queue (+ app/drink-switchback): switches to `drinkId` — a
 * queued drink being promoted (the one-tap confirm once the current
 * drink hits 0, never automatic, see DECISIONS.md), or any past drink
 * from this session being switched back to (app/drink-switchback's "pick
 * from a list" — the drink doesn't have to be the one most recently
 * switched away from, any of them works the same way). Either way: the
 * currently-serving drink (if any) is demoted first (demoteCurrentDrink —
 * re-queued as "Up next" if it still has alcohol in it, otherwise just
 * marked 'served'), then `drinkId` itself becomes 'serving'. `started_at`
 * is reset to now — purely a "when did this stint actually begin" display
 * value now, since remaining-volume math is driven entirely by each
 * pour's tagged `drink_id` (app/drink-switchback), not by comparing
 * timestamps, so resetting it here can never mis-attribute a pour. */
export async function switchToDrink(sessionId, drinkId) {
  await demoteCurrentDrink(sessionId, drinkId)
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
 * never gets picked up as "current" by mistake. Exactly one row has this
 * status at a time in practice (every path that sets a row to 'serving'
 * demotes the previous one first via demoteCurrentDrink), but the
 * ORDER BY + LIMIT 1 is kept as a defensive fallback. */
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
 * confirm. Both addDrink(..., 'queued') and demoteCurrentDrink only ever
 * leave one 'queued' row per session (each deletes any existing one
 * first), so this is just that row, or null. */
export async function getQueuedDrink(sessionId) {
  const db = getDatabase()
  const result = await db.query(
    "SELECT id, name, volume_ml, started_at FROM drinks WHERE session_id = ? AND status = 'queued' ORDER BY started_at DESC LIMIT 1",
    [sessionId],
  )
  return result.values?.[0] ?? null
}

/** app/drink-switchback: every drink that was actually served at some
 * point this session — 'serving' (the current one) plus 'served' (history
 * it was switched away from) — oldest first, excluding any 'queued' row
 * that was never promoted (that one was never actually served). Backs the
 * "switch back to a past drink" picker in ActiveSessionScreen's Switch
 * dialog; remaining volume for each one is computed client-side there
 * from the same `events` list already in state (same formula this file's
 * own getRemainingMl uses), rather than re-querying per row here. */
export async function getSessionDrinkHistory(sessionId) {
  const db = getDatabase()
  const result = await db.query(
    "SELECT id, name, volume_ml, started_at, status FROM drinks WHERE session_id = ? AND status IN ('serving', 'served') ORDER BY started_at ASC",
    [sessionId],
  )
  return result.values ?? []
}

/** The full drink log for one session, oldest first — backs
 * `app/history-detail`'s drink-log section, same "show the whole log, not
 * just the latest" idea as getSessionEvents' Activity log. Filtered to
 * status IN ('serving', 'served') (app/drink-switchback) — a
 * queued-but-never-promoted row was never actually served, so it doesn't
 * belong in "what was served"; 'served' rows (drinks switched away from,
 * whether finished or still mid-session) belong in the log just as much
 * as the one still 'serving'. */
export async function getSessionDrinks(sessionId) {
  const db = getDatabase()
  const result = await db.query(
    "SELECT id, name, volume_ml, started_at FROM drinks WHERE session_id = ? AND status IN ('serving', 'served') ORDER BY started_at ASC",
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
    `SELECT e.id, e.type, e.volume, e.note, e.drink_id, e.timestamp, e.participant_id, p.name as participant_name
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
