import { useCallback, useEffect, useState } from 'react'
import { getSessionHistory } from '../storage/sessionQueries'
import { pullSessions } from '../sync/pull'

/**
 * Past sessions, newest first. Always reads from local SQLite (the single
 * source of truth — see ARCHITECTURE.md's offline-first pattern), and now
 * reads it *first* — the local read used to be sequenced after an `await
 * pullSessions()`, which left the loading skeleton showing for however long
 * the Supabase pull took (or took to fail) even though `navigator.onLine`
 * being true doesn't guarantee real connectivity, so an offline/flaky
 * connection meant History visibly "loaded" before showing data that was
 * already sitting on the device the whole time (reported by the user: "it
 * loads first... I think it's syncing before it displays the offline
 * data"). Pull (app/history-sync-fallback) still runs, best-effort, but now
 * as a background top-up after the local rows are already on screen — it
 * only triggers a second render if it actually finds something missing
 * locally (a reinstall, a cleared local DB) to merge in.
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
      // Local-first: show what's already on this device right away, never
      // blocked on the network.
      const localRows = await getSessionHistory()
      setSessions(localRows)
    } catch (err) {
      console.error('Failed to load session history', err)
    } finally {
      setLoading(false)
    }

    // Background top-up: best-effort, never re-shows the skeleton. Only
    // re-reads local SQLite (and re-renders) if the pull actually found
    // sessions this device didn't have yet.
    try {
      const pullResult = await pullSessions()
      setSyncedFromCloud(pullResult.ok)
      if (pullResult.ok && pullResult.pulled > 0) {
        const rows = await getSessionHistory()
        setSessions(rows)
      }
    } catch (err) {
      console.error('Background history sync failed', err)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  // app/history-list (swipe-to-delete): an optimistic local removal,
  // separate from refresh() - refresh() flips `loading` back to true for
  // its local-read phase, which would flash the skeleton list back in
  // right after a delete, undoing the smooth swipe animation that led up
  // to it. The caller removes the row from state immediately (after the
  // DB delete has actually succeeded), no skeleton flash, no re-fetch.
  const removeSession = useCallback((sessionId) => {
    setSessions((prev) => prev.filter((s) => s.id !== sessionId))
  }, [])

  return { sessions, loading, refresh, removeSession, syncedFromCloud }
}
