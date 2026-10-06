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
    const { data: remoteSessions, error: sessionsError } = await supabase
      .from('sessions')
      .select('id, started_at, ended_at')
      .eq('device_id', deviceId)
    if (sessionsError) throw sessionsError
    if (!remoteSessions || remoteSessions.length === 0) return { ok: true, pulled: 0 }

    const localIdsResult = await db.query('SELECT id FROM sessions')
    const localIds = new Set((localIdsResult.values ?? []).map((row) => row.id))
    const missingSessions = remoteSessions.filter((s) => !localIds.has(s.id))
    if (missingSessions.length === 0) return { ok: true, pulled: 0 }

    const missingIds = missingSessions.map((s) => s.id)

    const [{ data: remoteParticipants, error: participantsError }, { data: remoteEvents, error: eventsError }] =
      await Promise.all([
        supabase.from('participants').select('id, session_id, name').in('session_id', missingIds),
        supabase
          .from('events')
          .select('id, session_id, participant_id, type, timestamp')
          .in('session_id', missingIds),
      ])
    if (participantsError) throw participantsError
    if (eventsError) throw eventsError

    const now = new Date().toISOString()
    const set = [
      ...missingSessions.map((s) => ({
        statement:
          'INSERT OR IGNORE INTO sessions (id, device_id, started_at, ended_at, synced_at) VALUES (?, ?, ?, ?, ?)',
        values: [s.id, deviceId, s.started_at, s.ended_at, now],
      })),
      ...(remoteParticipants ?? []).map((p) => ({
        statement: 'INSERT OR IGNORE INTO participants (id, session_id, name, synced) VALUES (?, ?, ?, 1)',
        values: [p.id, p.session_id, p.name],
      })),
      ...(remoteEvents ?? []).map((e) => ({
        statement:
          'INSERT OR IGNORE INTO events (id, session_id, participant_id, type, timestamp, synced) VALUES (?, ?, ?, ?, ?, 1)',
        values: [e.id, e.session_id, e.participant_id, e.type, e.timestamp],
      })),
    ]
    await db.executeSet(set, false)

    return { ok: true, pulled: missingSessions.length }
  } catch (err) {
    if (isNetworkError(err)) {
      console.warn('Pull skipped, no connection — showing local-only history', err)
      return { ok: false, reason: 'offline', error: err }
    }
    console.error('Pull failed — showing local-only history', err)
    return { ok: false, reason: 'error', error: err }
  }
}
