import { supabase } from './supabaseClient'
import { getDeviceId } from './auth'
import { getDatabase } from '../storage/db'
import { isNetworkError } from './networkError'

/**
 * app/history-sync-fallback: pulls this device's sessions (+ their
 * participants/events) down from Supabase and inserts any that aren't
 * already in local SQLite — covers a reinstall, a cleared local DB, or any
 * other case where Supabase has rows this device doesn't currently have
 * locally. Pulled rows are inserted as already-synced (they came from
 * Supabase, so there's nothing left to push for them).
 *
 * History itself always reads from local SQLite only (see
 * sessionQueries.js) — this function's job is just to make sure that local
 * copy is as complete as it can be before that read happens. If the pull is
 * skipped or fails (offline, not configured, not signed in), the read
 * underneath still succeeds with whatever's already local — that's the
 * "falls back to local-only" half of this task, and it needs no special
 * handling, since skipping the pull is itself the fallback.
 */
export async function pullSessions() {
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
    // app/people-roster-sync: pulled independently of the sessions below —
    // the roster isn't scoped to any one session, so "this device has all
    // its sessions already" doesn't mean it has every roster entry (e.g.
    // someone was renamed/added from a different device, or this is a
    // reinstall). Cheap either way: one query, insert whatever's missing.
    const peoplePulled = await pullPeople(db, deviceId)
    // app/saved-drinks: same reasoning as people: not tied to any session.
    await pullSavedDrinks(db, deviceId)

    const { data: remoteSessions, error: sessionsError } = await supabase
      .from('sessions')
      .select('id, name, started_at, ended_at')
      .eq('device_id', deviceId)
    if (sessionsError) throw sessionsError
    if (!remoteSessions || remoteSessions.length === 0) {
      return { ok: true, pulled: 0, peoplePulled }
    }

    const localIdsResult = await db.query('SELECT id FROM sessions')
    const localIds = new Set((localIdsResult.values ?? []).map((row) => row.id))
    const missingSessions = remoteSessions.filter((s) => !localIds.has(s.id))
    if (missingSessions.length === 0) return { ok: true, pulled: 0, peoplePulled }

    const missingIds = missingSessions.map((s) => s.id)

    const [
      { data: remoteParticipants, error: participantsError },
      { data: remoteEvents, error: eventsError },
      { data: remoteDrinks, error: drinksError },
    ] = await Promise.all([
      supabase.from('participants').select('id, session_id, name, person_id').in('session_id', missingIds),
      supabase
        .from('events')
        .select('id, session_id, participant_id, type, volume, note, outcome, left_ml, timestamp')
        .in('session_id', missingIds),
      // app/drink-tracking: pulled alongside participants/events for the
      // same missing sessions — same "only ever filling in what's not
      // already local" rule as everything else in this function.
      supabase.from('drinks').select('id, session_id, name, volume_ml, started_at').in('session_id', missingIds),
    ])
    if (participantsError) throw participantsError
    if (eventsError) throw eventsError
    if (drinksError) throw drinksError

    const now = new Date().toISOString()
    const set = [
      ...missingSessions.map((s) => ({
        statement:
          'INSERT OR IGNORE INTO sessions (id, device_id, name, started_at, ended_at, synced_at) VALUES (?, ?, ?, ?, ?, ?)',
        values: [s.id, deviceId, s.name, s.started_at, s.ended_at, now],
      })),
      ...(remoteParticipants ?? []).map((p) => ({
        statement:
          'INSERT OR IGNORE INTO participants (id, session_id, name, person_id, synced) VALUES (?, ?, ?, ?, 1)',
        values: [p.id, p.session_id, p.name, p.person_id],
      })),
      ...(remoteEvents ?? []).map((e) => ({
        statement:
          'INSERT OR IGNORE INTO events (id, session_id, participant_id, type, volume, note, outcome, left_ml, timestamp, synced) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)',
        values: [e.id, e.session_id, e.participant_id, e.type, e.volume, e.note, e.outcome, e.left_ml, e.timestamp],
      })),
      ...(remoteDrinks ?? []).map((d) => ({
        statement:
          'INSERT OR IGNORE INTO drinks (id, session_id, name, volume_ml, started_at, synced) VALUES (?, ?, ?, ?, ?, 1)',
        values: [d.id, d.session_id, d.name, d.volume_ml, d.started_at],
      })),
    ]
    await db.executeSet(set, false)

    return { ok: true, pulled: missingSessions.length, peoplePulled }
  } catch (err) {
    if (isNetworkError(err)) {
      console.warn('Pull skipped, no connection — showing local-only history', err)
      return { ok: false, reason: 'offline', error: err }
    }
    console.error('Pull failed — showing local-only history', err)
    return { ok: false, reason: 'error', error: err }
  }
}


/** app/saved-drinks: inserts any remote saved drinks for this device that
 * aren't local yet, skipping ones the user deleted here (tombstoned in
 * deleted_saved_drinks). Same rules as pullPeople below. */
async function pullSavedDrinks(db, deviceId) {
  const { data: remote, error } = await supabase
    .from('saved_drinks')
    .select('id, name, volume_ml, created_at, last_used_at')
    .eq('device_id', deviceId)
  if (error) throw error
  if (!remote || remote.length === 0) return 0

  const localResult = await db.query('SELECT id FROM saved_drinks')
  const localIds = new Set((localResult.values ?? []).map((row) => row.id))
  const deletedResult = await db.query('SELECT id FROM deleted_saved_drinks')
  const deletedIds = new Set((deletedResult.values ?? []).map((row) => row.id))
  const missing = remote.filter((d) => !localIds.has(d.id) && !deletedIds.has(d.id))
  if (missing.length === 0) return 0

  await db.executeSet(
    missing.map((d) => ({
      statement:
        'INSERT OR IGNORE INTO saved_drinks (id, device_id, name, volume_ml, created_at, last_used_at, synced) VALUES (?, ?, ?, ?, ?, ?, 1)',
      values: [d.id, deviceId, d.name, d.volume_ml, d.created_at, d.last_used_at],
    })),
    false,
  )
  return missing.length
}

/** app/people-roster-sync: inserts any remote `people` rows for this device
 * that aren't already present locally, keyed by id (same `INSERT OR IGNORE`
 * convention as the rest of this file — local wins if a row somehow exists
 * both places already). Pulled rows are marked already-synced, matching
 * `pullSessions`'s own rows. Returns the count inserted; never throws (the
 * caller's try/catch covers it, same as everything else in here). */
async function pullPeople(db, deviceId) {
  const { data: remotePeople, error } = await supabase
    .from('people')
    .select('id, name, created_at, last_used_at')
    .eq('device_id', deviceId)
  if (error) throw error
  if (!remotePeople || remotePeople.length === 0) return 0

  const localIdsResult = await db.query('SELECT id FROM people')
  const localIds = new Set((localIdsResult.values ?? []).map((row) => row.id))
  // app/people-roster-delete-tombstone: a remote row the user deleted
  // locally is still "missing locally" by id, so without this it would
  // get re-inserted by the filter below on every pull — exactly the
  // "deleted people coming back" bug. Tombstoned ids are excluded from
  // what counts as missing, same as if they'd never existed remotely.
  const deletedIdsResult = await db.query('SELECT id FROM deleted_people')
  const deletedIds = new Set((deletedIdsResult.values ?? []).map((row) => row.id))
  const missing = remotePeople.filter((p) => !localIds.has(p.id) && !deletedIds.has(p.id))
  if (missing.length === 0) return 0

  await db.executeSet(
    missing.map((p) => ({
      statement:
        'INSERT OR IGNORE INTO people (id, device_id, name, created_at, last_used_at, synced) VALUES (?, ?, ?, ?, ?, 1)',
      values: [p.id, deviceId, p.name, p.created_at, p.last_used_at],
    })),
    false,
  )
  return missing.length
}
