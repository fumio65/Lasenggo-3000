import { useCallback, useEffect, useState } from 'react'
import { getSessionHistory } from '../storage/sessionQueries'

/**
 * Past sessions, newest first, from local SQLite. Returns `refresh()` so a
 * caller can re-pull after a session ends, since there's no live DB
 * subscription — SQLite reads are one-shot.
 */
export function useSessionHistory() {
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
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

  return { sessions, loading, refresh }
}
