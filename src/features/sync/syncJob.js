import { supabase } from './supabaseClient'
import { getDeviceId } from './auth'
import { getDatabase } from '../storage/db'

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

  const deviceId = await getDeviceId()
  if (!deviceId) return { ok: false, reason: 'not-signed-in' }

  const db = getDatabase()

  try {
    const sessionsPushed = await syncSessions(db, deviceId)
    const participantsPushed = await syncParticipants(db)
    const eventsPushed = await syncEvents(db)
    return {
      ok: true,
      pushed: { sessionsPushed, participantsPushed, eventsPushed },
    }
  } catch (err) {
    console.error('Sync failed, unsynced rows stay queued for next attempt', err)
    return { ok: false, reason: 'error', error: err }
  }
}

async function syncSessions(db, deviceId) {
  const result = await db.query(
    'SELECT id, started_at, ended_at FROM sessions WHERE synced_at IS NULL',
  )
  const rows = result.values ?? []
  if (rows.length === 0) return 0

  const payload = rows.map((r) => ({
    id: r.id,
    device_id: deviceId,
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
    'SELECT id, session_id, name FROM participants WHERE synced = 0',
  )
  const rows = result.values ?? []
  if (rows.length === 0) return 0

  const payload = rows.map((r) => ({ id: r.id, session_id: r.session_id, name: r.name }))
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
    'SELECT id, session_id, participant_id, type, timestamp FROM events WHERE synced = 0',
  )
  const rows = result.values ?? []
  if (rows.length === 0) return 0

  const payload = rows.map((r) => ({
    id: r.id,
    session_id: r.session_id,
    participant_id: r.participant_id,
    type: r.type,
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
