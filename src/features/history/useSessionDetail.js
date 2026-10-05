import { useEffect, useState } from 'react'
import { getSessionDetail } from '../storage/sessionQueries'

/** One session's details (header info + per-participant pour/pass counts). */
export function useSessionDetail(sessionId) {
  const [detail, setDetail] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!sessionId) return
    setLoading(true)
    getSessionDetail(sessionId)
      .then(setDetail)
      .catch((err) => console.error('Failed to load session detail', err))
      .finally(() => setLoading(false))
  }, [sessionId])

  return { detail, loading }
}
