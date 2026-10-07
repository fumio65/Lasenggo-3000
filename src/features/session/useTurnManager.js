import { useCallback, useState } from 'react'

/**
 * Circular turn order over a participant list.
 *
 * Scope note: this hook owns *whose turn it is* and advancing it on a
 * confirmed POUR or a PASS, per TASKS.md's "Turn manager logic" task. It does
 * NOT persist events to SQLite (`app/local-event-logging`) and does NOT send
 * any BLE command (`app/ble-commands`) — those are separate tasks. `onPass`
 * and `onPourConfirmed` accept an optional `onEvent(type, participant)`
 * callback so event logging can be wired in later without reshaping this hook.
 *
 * app/pass-limit-house-rule: also tracks each participant's *consecutive*
 * pass streak (how many times in a row they've passed on their own turns,
 * resetting to 0 the moment they pour). `passLimit` is an optional positive
 * integer; when a participant's streak reaches it, `isOverPassLimit` is true
 * for their turn. This is intentionally a soft signal only — nothing here
 * disables Pass. A hard block makes no sense yet, since Pour is still
 * disabled (no BLE/app/ble-commands), so a participant who hit the limit
 * would have no valid action left and the session would just get stuck.
 * Once Pour is real, the caller can choose to disable Pass on
 * `isOverPassLimit` for an actual forced-pour house rule — this hook
 * already has everything that decision needs.
 *
 * app/undo-last-action: before each Pass/Pour mutates `currentIndex`/
 * `passStreaks`, a snapshot of both goes into `undoSnapshot` — one level
 * only (undoing replaces it with null, so a second undo in a row has
 * nothing to do). `undoTurn()` restores that snapshot. This hook only owns
 * turn order/streaks; it doesn't know about the logged SQLite event row at
 * all — the caller (ActiveSessionScreen) pairs a call to `undoTurn()` with
 * deleting the right event itself, since this hook has no event ids to
 * work with.
 */
export function useTurnManager(participants, { onEvent, passLimit = null } = {}) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [passStreaks, setPassStreaks] = useState({})
  const [undoSnapshot, setUndoSnapshot] = useState(null)

  const advanceTurn = useCallback(() => {
    setCurrentIndex((prev) =>
      participants.length === 0 ? 0 : (prev + 1) % participants.length
    )
  }, [participants.length])

  const onPass = useCallback(() => {
    const current = participants[currentIndex]
    if (current) {
      onEvent?.('PASS', current)
      setUndoSnapshot({ currentIndex, passStreaks })
      setPassStreaks((prev) => ({ ...prev, [current.id]: (prev[current.id] ?? 0) + 1 }))
    }
    advanceTurn()
  }, [participants, currentIndex, passStreaks, onEvent, advanceTurn])

  // Called once a POUR is confirmed by hardware (STATUS: POURED/HAS_DRINK).
  // Not reachable from the UI yet — app/ble-commands + app/ble-status-subscription
  // need to exist first to produce that confirmation.
  const onPourConfirmed = useCallback(() => {
    const current = participants[currentIndex]
    if (current) {
      onEvent?.('POUR', current)
      setUndoSnapshot({ currentIndex, passStreaks })
      setPassStreaks((prev) => ({ ...prev, [current.id]: 0 }))
    }
    advanceTurn()
  }, [participants, currentIndex, passStreaks, onEvent, advanceTurn])

  const undoTurn = useCallback(() => {
    if (!undoSnapshot) return
    setCurrentIndex(undoSnapshot.currentIndex)
    setPassStreaks(undoSnapshot.passStreaks)
    setUndoSnapshot(null)
  }, [undoSnapshot])

  const safeIndex = currentIndex % Math.max(participants.length, 1)
  const current = participants[safeIndex]
  const currentPassStreak = current ? (passStreaks[current.id] ?? 0) : 0
  const isOverPassLimit = Boolean(passLimit) && currentPassStreak >= passLimit

  return {
    currentIndex: safeIndex,
    current,
    onPass,
    onPourConfirmed,
    currentPassStreak,
    isOverPassLimit,
    canUndo: undoSnapshot !== null,
    undoTurn,
  }
}
