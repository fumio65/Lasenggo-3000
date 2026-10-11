import { useEffect, useState } from 'react'
import { getSessionDetail, getSessionEvents } from '../storage/sessionQueries'

/** One session's details (header info + per-participant pour/pass counts)
 * plus its full chronological event list, for HistoryDetail's "Activity
 * log" section — a past session's events never change, so there's no
 * need for the live-session dance of refetching after every action. */
export function useSessionDetail(sessionId) {
  const [detail, setDetail] = useState(null)
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!sessionId) return
    setLoading(true)
    Promise.all([getSessionDetail(sessionId), getSessionEvents(sessionId)])
      .then(([detailResult, eventsResult]) => {
        setDetail(detailResult)
        setEvents(eventsResult)
      })
      .catch((err) => console.error('Failed to load session detail', err))
      .finally(() => setLoading(false))
  }, [sessionId])

  return { detail, events, loading }
}
