import { getDatabase } from './db'
import { recordSavedDrink } from './savedDrinkQueries'
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
  // app/saved-drinks: remember it for tap-to-fill next time.
  if (trimmedDrinkName) await recordSavedDrink(trimmedDrinkName, drinkVolumeMl)
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

/** app/drink-outcome: records what happened to one poured drink — see
 * db.js's migrateAddEventOutcome for the meaning of each value. Resets
 * `synced` to 0 so the sync job re-pushes the row: the POUR itself was
 * usually already logged (and may already be in Supabase) before the
 * outcome is known, and syncEvents upserts by id, so a re-push updates the
 * existing remote row rather than duplicating it. */
export async function setPourOutcome(eventId, outcome, leftMl) {
  const db = getDatabase()
  await db.run(
    'UPDATE events SET outcome = ?, left_ml = ?, synced = 0 WHERE id = ?',
    [outcome, leftMl, eventId],
    false,
  )
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
 * depends on whether it still has alcohol in it — the whole point of the
 * feature ("I can still switch it back since there's still alcohol on
 * it"). Still has remaining volume (or none was ever declared, so
 * there's nothing to disprove) -> joins "Up next" as another queued row
 * — app/drink-queue-list made "Up next" a real multi-item queue, so
 * there's no single slot to fight over any more, and nothing else ever
 * needs to be bumped, replaced, or excluded to make room. Actually
 * empty -> plain history ('served') instead. No-op if nothing is
 * currently serving. */
async function demoteCurrentDrink(sessionId) {
  const current = await getCurrentDrink(sessionId)
  if (!current) return
  const db = getDatabase()
  const remaining = await getRemainingMl(current.id, current.volume_ml)
  const stillHasVolume = remaining == null || remaining > 0
  await db.run(
    `UPDATE drinks SET status = '${stillHasVolume ? 'queued' : 'served'}' WHERE id = ?`,
    [current.id],
    false,
  )
}

/** app/drink-tracking (+ app/drink-queue, app/drink-queue-list): logs a
 * drink row — called once at Start Session (if a drink was given; see
 * createSession), every time someone taps "Same drink" (a fresh
 * bottle/batch of the same thing), and for both "switch now" and "queue
 * for later" in the UI. `status` is 'serving' for the first three (it's
 * immediately what's being served) and 'queued' for the last (staged
 * ahead of time, not yet active — see db.js's drinks table notes and
 * DECISIONS.md). "Up next" is a real multi-item queue (app/drink-
 * queue-list) — queuing a new drink adds another row rather than
 * replacing whatever's already staged, same as "Same drink"/"different
 * drink" never used to replace history either. Inserting a new
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
  await db.run(
    'INSERT INTO drinks (id, session_id, name, volume_ml, started_at, status, synced) VALUES (?, ?, ?, ?, ?, ?, 0)',
    [id, sessionId, name.trim(), volumeMl ?? null, new Date().toISOString(), status],
    false,
  )
  // app/saved-drinks: covers switch, queue, "same drink" and start-tracking.
  await recordSavedDrink(name, volumeMl)
  return id
}

/** app/drink-tracking (mid-session "start tracking a drink" follow-up):
 * a POUR logged before any drink existed this session (drink tracking
 * skipped at Start Session, or every drink demoted/served out) gets
 * `drink_id = NULL` (see `logEvent`'s `drinkId` param, and `onEvent`'s
 * `currentDrinkIdRef.current` in ActiveSessionScreen, which is null in
 * exactly that situation) - so `remainingForDrink`'s "declared volume
 * minus every POUR tagged with this id" formula has nothing to subtract,
 * and a drink declared after the fact looks full even though real pours
 * already happened against it. Those earlier untagged pours *were* this
 * drink - there was only ever one thing being poured, the person just
 * hadn't told the app its name/volume yet - so backfilling them onto the
 * newly-declared drink's id is correcting a gap in when it was logged,
 * not rewriting what actually happened. Scoped to this session and to
 * still-untagged rows only, so it never touches a pour that was already
 * correctly tagged against an earlier (now switched-away-from) drink. */
export async function backfillUntaggedPours(sessionId, drinkId) {
  const db = getDatabase()
  await db.run(
    "UPDATE events SET drink_id = ? WHERE session_id = ? AND type = 'POUR' AND drink_id IS NULL",
    [drinkId, sessionId],
    false,
  )
}

/** app/drink-queue-list (+ app/drink-edit-current): edits a drink's name
 * and/or volume in place — the "edit" action on an "Up next" row, and
 * (now) on "Now serving" too, for fixing a typo'd name or a mistyped mL
 * right after logging it. Scoped to `status IN ('queued', 'serving')` in
 * the WHERE clause rather than trusting the caller: once a drink has been
 * demoted to `'served'`, it's past history, and may already have real
 * pours tagged against its id — silently changing its declared volume at
 * that point would be rewriting history rather than fixing a live
 * mistake. A past drink's name/volume staying fixed once it's no longer
 * current or queued is deliberate, not an oversight. */
export async function updateDrink(drinkId, name, volumeMl = null) {
  const db = getDatabase()
  await db.run(
    "UPDATE drinks SET name = ?, volume_ml = ? WHERE id = ? AND status IN ('queued', 'serving')",
    [name.trim(), volumeMl ?? null, drinkId],
    false,
  )
  // app/saved-drinks: an edit usually fixes a typo, so remember the
  // corrected version too (the typo'd entry can be removed on the Drinks
  // screen).
  await recordSavedDrink(name, volumeMl)
}

/** app/drink-queue: switches to `drinkId` — a queued drink being
 * promoted (one-tap confirm, never automatic, see DECISIONS.md), or
 * (app/drink-switchback) any past drink from this session being switched
 * back to, picked from a list — the drink doesn't have to be the one
 * most recently switched away from, any of them works the same way.
 * Either way: the currently-serving drink (if any) is demoted first
 * (demoteCurrentDrink — joins "Up next" if it still has alcohol in it,
 * otherwise just marked 'served'), then `drinkId` itself becomes
 * 'serving'. `started_at` is reset to now — purely a "when did this
 * stint actually begin" display value now, since remaining-volume math
 * is driven entirely by each pour's tagged `drink_id` (app/drink-
 * switchback), not by comparing timestamps, so resetting it here can
 * never mis-attribute a pour. */
export async function switchToDrink(sessionId, drinkId) {
  await demoteCurrentDrink(sessionId)
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
 * deleteEvent's undo. Works on any one queue entry by id, so it doubles
 * as the "delete" action on an individual "Up next" row (app/drink-
 * queue-list) — no change needed there now that the queue holds more
 * than one row. */
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

/** app/drink-queue-list: every drink staged to serve next, oldest-queued
 * first (first in, first "up next") — backs the "Up next" list on
 * ActiveSessionScreen, each with its own "Switch now"/edit/delete. Used
 * to be a single slot (`getQueuedDrink`, at most one 'queued' row ever
 * existed); now any number can be staged at once — queuing a new one no
 * longer replaces an existing one, and a drink that's demoted off
 * "Now serving" while it still has alcohol in it joins this list rather
 * than fighting over a slot. */
export async function getQueuedDrinks(sessionId) {
  const db = getDatabase()
  const result = await db.query(
    "SELECT id, name, volume_ml, started_at FROM drinks WHERE session_id = ? AND status = 'queued' ORDER BY started_at ASC",
    [sessionId],
  )
  return result.values ?? []
}

/** app/drink-switchback: every drink that was actually served at some
 * point this session — 'serving' (the current one) plus 'served' (history
 * it was switched away from) — oldest first, excluding any 'queued' row
 * (app/drink-queue-list's "Up next" list is where those live instead;
 * this stays the "switch back to a past drink" picker's source, so the
 * two don't show the same drink in two different lists). Remaining
 * volume for each one is computed client-side from the same `events`
 * list already in state (same formula this file's own getRemainingMl
 * uses), rather than re-querying per row here. */
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
 * just the latest" idea as getSessionEvents' Activity log.
 *
 * Fix (app/drink-session-log): this used to filter to
 * `status IN ('serving', 'served')`, on the reasoning that a queued row
 * was "never actually served". That reasoning doesn't hold once a drink
 * can be *re*-queued: demoteCurrentDrink re-queues (not "serves") a drink
 * switched away from while it still has volume left (app/drink-
 * switchback), so a drink genuinely poured from earlier in the session
 * could end up back in `'queued'` and then silently vanish from history
 * the moment the session ends before it's promoted again — reported as
 * "it just records the last drink", since everything re-queued along the
 * way got filtered out. No status filter at all now: every drink row the
 * session ever created belongs in its history, including one still
 * sitting in `'queued'` (never promoted, or re-queued and never promoted
 * back) when the session ended — HistoryDetail is responsible for
 * labeling those appropriately, not this query for hiding them. */
export async function getSessionDrinks(sessionId) {
  const db = getDatabase()
  const result = await db.query(
    'SELECT id, name, volume_ml, started_at, status FROM drinks WHERE session_id = ? ORDER BY started_at ASC',
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
 * participant's name, the pour volume (for POUR rows; NULL for PASS), and
 * now (app/drink-session-log) the name of whichever drink was being
 * served at the moment of that pour (`e.drink_id`, tagged per-pour since
 * app/drink-tracking's switchback follow-up) joined in — backs the
 * "session log" panel on ActiveSessionScreen: its per-participant
 * Light/Standard/Heavy/mL breakdown (now also "which drink(s) this
 * person actually had"), the recent activity list, and the Drinks log.
 * LEFT JOIN, not JOIN: a PASS row has no drink_id at all, and even a POUR
 * row's drink could in principle have been deleted since (cancelQueuedDrink
 * is a real DELETE) — drink_name just comes back null rather than
 * silently dropping the whole event. Not capped — a casual session's
 * event count is small enough that aggregating client-side from the full
 * list is simpler (and more honest) than maintaining a second,
 * separately-capped query. */
export async function getSessionEvents(sessionId) {
  const db = getDatabase()
  const result = await db.query(
    `SELECT e.id, e.type, e.volume, e.note, e.drink_id, e.outcome, e.left_ml, e.timestamp, e.participant_id, p.name as participant_name, d.name as drink_name
     FROM events e
     JOIN participants p ON p.id = e.participant_id
     LEFT JOIN drinks d ON d.id = e.drink_id
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

/** app/history-resume: clears `ended_at` back to null so this session
 * reads as live again everywhere that checks it (getSessionHistory's
 * list still shows it either way - a session shows up in History purely
 * by existing, ended or not - but App.jsx treats a non-null `ended_at`
 * as "this round is over" for anything that branches on it). Does not
 * touch any events/drinks/participants rows - resuming is just un-ending
 * a session, never a different operation from the one that ended it. */
export async function resumeSession(sessionId) {
  const db = getDatabase()
  await db.run('UPDATE sessions SET ended_at = NULL WHERE id = ?', [sessionId], false)
}

/** app/history-resume: the session row plus its participants in turn
 * order (`ORDER BY rowid`, the same insertion order addSessionParticipant
 * wrote them in - there's no separate "turn position" column, rowid is
 * already exactly that), including `person_id` - getSessionDetail's own
 * participants query leaves that out since it only needs it for display
 * stats, but resuming needs it to carry into the in-memory roster
 * (App.jsx's useParticipants) the same way adding someone normally does. */
export async function getSessionForResume(sessionId) {
  const db = getDatabase()
  const sessionResult = await db.query('SELECT * FROM sessions WHERE id = ?', [sessionId])
  const session = sessionResult.values?.[0] ?? null
  const participantsResult = await db.query(
    'SELECT id, name, person_id FROM participants WHERE session_id = ? ORDER BY rowid',
    [sessionId],
  )
  return { session, participants: participantsResult.values ?? [] }
}

/** app/history-list (swipe-to-delete): permanently removes a past
 * session and everything under it. No `ON DELETE CASCADE` on these
 * tables (see db.js's schema — plain `REFERENCES`, foreign_keys pragma
 * never turned on), so this deletes in dependency order by hand: events
 * and drinks reference the session directly, participants too, and
 * `sessions` itself comes last so nothing is ever left pointing at a row
 * that's already gone. Irreversible - the UI confirms with the user
 * before ever calling this (see HistoryList's delete dialog). */
export async function deleteSession(sessionId) {
  const db = getDatabase()
  await db.run('DELETE FROM events WHERE session_id = ?', [sessionId], false)
  await db.run('DELETE FROM drinks WHERE session_id = ?', [sessionId], false)
  await db.run('DELETE FROM participants WHERE session_id = ?', [sessionId], false)
  await db.run('DELETE FROM sessions WHERE id = ?', [sessionId], false)
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
