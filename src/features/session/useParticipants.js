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

  // Generates the id outside setParticipants (not inside the updater
  // callback) specifically so it can be returned synchronously — a caller
  // adding someone mid-session (app/add-participant-mid-session) needs
  // that id right away to also insert the matching DB row for the
  // current session.
  const addParticipant = useCallback((name) => {
    const trimmed = name.trim()
    if (!trimmed) return null
    const id = crypto.randomUUID()
    setParticipants((prev) => [...prev, { id, name: trimmed }])
    return id
  }, [])

  const removeParticipant = useCallback((id) => {
    setParticipants((prev) => prev.filter((p) => p.id !== id))
  }, [])

  // app/clear-after-session: a finished round's participant ids are already
  // written into that session's DB rows (createSession/addSessionParticipant
  // insert by id, and `participants.id` is a primary key) — carrying them
  // into a second session would try to reuse those same ids under a new
  // session_id and fail with a UNIQUE constraint error the moment Start
  // session is clicked again. Clearing the roster after a session ends,
  // rather than trying to reuse it, sidesteps that entirely: next round
  // starts from an empty "Who's joining" like a brand-new one.
  const clearParticipants = useCallback(() => {
    setParticipants([])
  }, [])

  // app/edit-participant-name: fixes a typo'd name, including mid-session —
  // the same id is used for the DB row that's already been inserted for
  // the current session (see sessionQueries.renameParticipant), so this is
  // the in-memory half of that edit; the caller pairs the two.
  const renameParticipant = useCallback((id, name) => {
    const trimmed = name.trim()
    if (!trimmed) return
    setParticipants((prev) => prev.map((p) => (p.id === id ? { ...p, name: trimmed } : p)))
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

  // UX pass: backs the drag-to-reorder grip handle in ParticipantList. Same
  // splice logic as moveParticipant, generalized to an arbitrary target
  // index instead of a fixed +1/-1 step, since a drag can jump several
  // spots in one move.
  const reorderParticipants = useCallback((fromIndex, toIndex) => {
    setParticipants((prev) => {
      if (
        fromIndex === toIndex ||
        fromIndex < 0 ||
        fromIndex >= prev.length ||
        toIndex < 0 ||
        toIndex >= prev.length
      ) {
        return prev
      }
      const next = [...prev]
      const [moved] = next.splice(fromIndex, 1)
      next.splice(toIndex, 0, moved)
      return next
    })
  }, [])

  return {
    participants,
    addParticipant,
    removeParticipant,
    renameParticipant,
    clearParticipants,
    moveParticipant,
    reorderParticipants,
  }
}
