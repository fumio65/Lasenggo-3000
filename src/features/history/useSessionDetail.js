import { useEffect, useState } from 'react'
import { getSessionDetail, getSessionEvents, getSessionDrinks } from '../storage/sessionQueries'

/** One session's details (header info + per-participant pour/pass counts)
 * plus its full chronological event list and drink log, for HistoryDetail's
 * "Activity log"/"Drinks" sections — a past session's rows never change,
 * so there's no need for the live-session dance of refetching after every
 * action. */
export function useSessionDetail(sessionId) {
  const [detail, setDetail] = useState(null)
  const [events, setEvents] = useState([])
  const [drinks, setDrinks] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!sessionId) return
    setLoading(true)
    Promise.all([getSessionDetail(sessionId), getSessionEvents(sessionId), getSessionDrinks(sessionId)])
      .then(([detailResult, eventsResult, drinksResult]) => {
        setDetail(detailResult)
        setEvents(eventsResult)
        setDrinks(drinksResult)
      })
      .catch((err) => console.error('Failed to load session detail', err))
      .finally(() => setLoading(false))
  }, [sessionId])

  return { detail, events, drinks, loading }
}
