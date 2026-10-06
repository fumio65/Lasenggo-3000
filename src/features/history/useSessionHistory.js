import { useCallback, useEffect, useState } from 'react'
import { getSessionHistory } from '../storage/sessionQueries'
import { pullSessions } from '../sync/pull'

/**
 * Past sessions, newest first. Always reads from local SQLite (the single
 * source of truth — see ARCHITECTURE.md's offline-first pattern), but first
 * tries a best-effort pull from Supabase (app/history-sync-fallback) so any
 * synced sessions missing locally (reinstall, cleared local DB, etc.) show
 * up too. A failed/skipped pull (offline, not configured) just means the
 * local read proceeds with whatever's already there — no error state, no
 * broken UI, that *is* the fallback.
 *
 * Returns `refresh()` so a caller can re-pull after a session ends, since
 * there's no live DB subscription — SQLite reads are one-shot.
 */
export function useSessionHistory() {
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [syncedFromCloud, setSyncedFromCloud] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const pullResult = await pullSessions()
      setSyncedFromCloud(pullResult.ok)
      const rows = await getSessionHistory()
      setSessions(rows)
    } catch (err) {
      console.error('Failed to load session history', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { sessions, loading, refresh, syncedFromCloud }
}
