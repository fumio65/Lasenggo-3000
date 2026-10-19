import { supabase } from './supabaseClient'
import { getDeviceId } from './auth'
import { getDatabase } from '../storage/db'
import { isNetworkError } from './networkError'

/**
 * Pushes unsynced local rows (sessions -> participants -> events, parents
 * before children so Supabase's foreign keys are satisfied) to Supabase and
 * marks them synced locally on success. Always optional and always safe to
 * call repeatedly — offline-first means this never runs instead of local
 * writes, only alongside/after them (backend/sync-reconnect-test covers the
 * actual offline -> online transition test).
 *
 * Returns { ok: true } on success, or { ok: false, reason } without
 * throwing — a failed sync (no network, Supabase down, not signed in) just
 * means the same unsynced rows get picked up again next call.
 */
export async function runSync() {
  if (!supabase) return { ok: false, reason: 'not-configured' }

  // Skip straight to the offline case instead of letting a fetch hang/time
  // out when the browser already knows there's no connection.
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return { ok: false, reason: 'offline' }
  }

  const deviceId = await getDeviceId()
  if (!deviceId) return { ok: false, reason: 'not-signed-in' }

  const db = getDatabase()

  try {
    // app/people-roster-sync: `people` pushes first — `participants.person_id`
    // is a foreign key into it on Supabase, so a person has to exist there
    // before a participant row referencing it can. `sessions` has no such
    // dependency either way, but is kept next since `participants` also
    // depends on it (session_id).
    const peoplePushed = await syncPeople(db, deviceId)
    // app/saved-drinks: independent of sessions, so order doesn't matter.
    const savedDrinksPushed = await syncSavedDrinks(db, deviceId)
    const sessionsPushed = await syncSessions(db, deviceId)
    const participantsPushed = await syncParticipants(db)
    const eventsPushed = await syncEvents(db)
    const drinksPushed = await syncDrinks(db)
    return {
      ok: true,
      pushed: { peoplePushed, savedDrinksPushed, sessionsPushed, participantsPushed, eventsPushed, drinksPushed },
    }
  } catch (err) {
    if (isNetworkError(err)) {
      // Expected whenever there's no connection — not a real failure, just the
      // normal "offline" case this task tests for. Rows stay queued either way.
      console.warn('Sync skipped, no connection — unsynced rows stay queued', err)
      return { ok: false, reason: 'offline', error: err }
    }
    console.error('Sync failed, unsynced rows stay queued for next attempt', err)
    return { ok: false, reason: 'error', error: err }
  }
}



/** backend/people-sync: pushes unsynced `people` rows, same shape/pattern
 * as `syncSessions` below (device_id stamped at push time, not creation
 * time — a person can be created offline long before this device ever
 * signs in). */
async function syncPeople(db, deviceId) {
  const result = await db.query(
    'SELECT id, name, created_at, last_used_at FROM people WHERE synced = 0',
  )
  const rows = result.values ?? []
  if (rows.length === 0) return 0

  const payload = rows.map((r) => ({
    id: r.id,
    device_id: deviceId,
    name: r.name,
    created_at: r.created_at,
    last_used_at: r.last_used_at,
  }))

  const { error } = await supabase.from('people').upsert(payload)
  if (error) throw error

  await db.executeSet(
    rows.map((r) => ({
      statement: 'UPDATE people SET device_id = ?, synced = 1 WHERE id = ?',
      values: [deviceId, r.id],
    })),
    false,
  )
  return rows.length
}

/** app/saved-drinks: pushes unsynced saved drinks, same shape as
 * syncPeople (device_id stamped at push time). Edits set synced = 0 again
 * (updateSavedDrink), and upsert-by-id turns that into an update. */
async function syncSavedDrinks(db, deviceId) {
  const result = await db.query(
    'SELECT id, name, volume_ml, created_at, last_used_at FROM saved_drinks WHERE synced = 0',
  )
  const rows = result.values ?? []
  if (rows.length === 0) return 0

  const payload = rows.map((r) => ({
    id: r.id,
    device_id: deviceId,
    name: r.name,
    volume_ml: r.volume_ml,
    created_at: r.created_at,
    last_used_at: r.last_used_at,
  }))
  const { error } = await supabase.from('saved_drinks').upsert(payload)
  if (error) throw error

  await db.executeSet(
    rows.map((r) => ({
      statement: 'UPDATE saved_drinks SET device_id = ?, synced = 1 WHERE id = ?',
      values: [deviceId, r.id],
    })),
    false,
  )
  return rows.length
}

async function syncSessions(db, deviceId) {
  const result = await db.query(
    'SELECT id, name, started_at, ended_at FROM sessions WHERE synced_at IS NULL',
  )
  const rows = result.values ?? []
  if (rows.length === 0) return 0

  const payload = rows.map((r) => ({
    id: r.id,
    device_id: deviceId,
    name: r.name,
    started_at: r.started_at,
    ended_at: r.ended_at,
  }))

  const { error } = await supabase.from('sessions').upsert(payload)
  if (error) throw error

  const now = new Date().toISOString()
  await db.executeSet(
    rows.map((r) => ({
      statement: 'UPDATE sessions SET device_id = ?, synced_at = ? WHERE id = ?',
      values: [deviceId, now, r.id],
    })),
    false,
  )
  return rows.length
}

async function syncParticipants(db) {
  const result = await db.query(
    'SELECT id, session_id, name, person_id FROM participants WHERE synced = 0',
  )
  const rows = result.values ?? []
  if (rows.length === 0) return 0

  // app/people-roster-sync: `person_id` rides along verbatim — it's already
  // either null or a `people.id` that `syncPeople` above just pushed (or
  // pushed in an earlier call), so there's nothing to resolve here.
  const payload = rows.map((r) => ({
    id: r.id,
    session_id: r.session_id,
    name: r.name,
    person_id: r.person_id,
  }))
  const { error } = await supabase.from('participants').upsert(payload)
  if (error) throw error

  await db.executeSet(
    rows.map((r) => ({
      statement: 'UPDATE participants SET synced = 1 WHERE id = ?',
      values: [r.id],
    })),
    false,
  )
  return rows.length
}

async function syncEvents(db) {
  const result = await db.query(
    'SELECT id, session_id, participant_id, type, volume, note, outcome, left_ml, timestamp FROM events WHERE synced = 0',
  )
  const rows = result.values ?? []
  if (rows.length === 0) return 0

  // app/pause-reason-tag, app/pour-volume-setting: `volume`/`note` were
  // being logged locally and silently never pushed — Supabase's `events`
  // table (and its `type` CHECK) predated both features. Caught and fixed
  // alongside restoring the paused Supabase project; see DECISIONS.md.
  const payload = rows.map((r) => ({
    id: r.id,
    session_id: r.session_id,
    participant_id: r.participant_id,
    type: r.type,
    volume: r.volume,
    note: r.note,
    // app/drink-outcome: set after the POUR row is first logged, so the
    // same row can come through here twice (setPourOutcome resets synced);
    // upsert-by-id turns the second push into an update.
    outcome: r.outcome,
    left_ml: r.left_ml,
    timestamp: r.timestamp,
  }))
  const { error } = await supabase.from('events').upsert(payload)
  if (error) throw error

  await db.executeSet(
    rows.map((r) => ({
      statement: 'UPDATE events SET synced = 1 WHERE id = ?',
      values: [r.id],
    })),
    false,
  )
  return rows.length
}

/** app/drink-tracking: pushes unsynced `drinks` rows — same shape as
 * `syncEvents` above (no `device_id` column on this table either; RLS on
 * the Supabase side scopes by joining back to `sessions.device_id`, same
 * as `participants`/`events`). */
async function syncDrinks(db) {
  const result = await db.query(
    'SELECT id, session_id, name, volume_ml, started_at FROM drinks WHERE synced = 0',
  )
  const rows = result.values ?? []
  if (rows.length === 0) return 0

  const payload = rows.map((r) => ({
    id: r.id,
    session_id: r.session_id,
    name: r.name,
    volume_ml: r.volume_ml,
    started_at: r.started_at,
  }))
  const { error } = await supabase.from('drinks').upsert(payload)
  if (error) throw error

  await db.executeSet(
    rows.map((r) => ({
      statement: 'UPDATE drinks SET synced = 1 WHERE id = ?',
      values: [r.id],
    })),
    false,
  )
  return rows.length
}

