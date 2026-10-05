import { useCallback, useState } from 'react'

/**
 * Local, in-memory participant list for the current session.
 *
 * Scope note: this hook only manages the add/remove/reorder UI state for
 * TASKS.md's "Participant list screen" task. It does NOT persist to SQLite
 * (see `app/sqlite-schema` / `app/local-event-logging`) and does NOT handle
 * whose turn it is (see `app/turn-manager`) — those are separate tasks that
 * will consume this list once built.
 */
export function useParticipants(initial = []) {
  const [participants, setParticipants] = useState(initial)

  const addParticipant = useCallback((name) => {
    const trimmed = name.trim()
    if (!trimmed) return
    setParticipants((prev) => [
      ...prev,
      { id: crypto.randomUUID(), name: trimmed },
    ])
  }, [])

  const removeParticipant = useCallback((id) => {
    setParticipants((prev) => prev.filter((p) => p.id !== id))
  }, [])

  const moveParticipant = useCallback((id, direction) => {
    setParticipants((prev) => {
      const index = prev.findIndex((p) => p.id === id)
      if (index === -1) return prev
      const targetIndex = index + direction
      if (targetIndex < 0 || targetIndex >= prev.length) return prev
      const next = [...prev]
      const [moved] = next.splice(index, 1)
      next.splice(targetIndex, 0, moved)
      return next
    })
  }, [])

  return { participants, addParticipant, removeParticipant, moveParticipant }
}
