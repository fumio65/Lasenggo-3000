import { useCallback, useEffect, useState } from 'react'

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
const EMPTY_SET = new Set()

export function useTurnManager(participants, { onEvent, passLimit = null, pausedIds = EMPTY_SET } = {}) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [passStreaks, setPassStreaks] = useState({})
  const [undoSnapshot, setUndoSnapshot] = useState(null)

  // app/pause-participant: a paused person is skipped when the turn
  // reaches them — stepping forward (not just +1) until it lands on
  // someone not in `pausedIds`, or giving up after a full lap if
  // everyone's paused (nothing valid to land on, so stay put rather than
  // spin forever).
  const nextActiveIndex = useCallback(
    (fromIndex) => {
      const total = participants.length
      if (total === 0) return 0
      let idx = fromIndex
      for (let step = 0; step < total; step += 1) {
        idx = (idx + 1) % total
        const candidate = participants[idx]
        if (candidate && !pausedIds.has(candidate.id)) return idx
      }
      return fromIndex % total // everyone's paused — nowhere valid to go
    },
    [participants, pausedIds],
  )

  const advanceTurn = useCallback(() => {
    setCurrentIndex((prev) => nextActiveIndex(prev))
  }, [nextActiveIndex])

  // Pausing someone mid-turn (the "emergency, has to step out right now"
  // case) shouldn't wait for a Pass/Pour to move on from them — jump to
  // the next active participant as soon as the pause takes effect.
  useEffect(() => {
    const safe = participants.length === 0 ? 0 : currentIndex % participants.length
    const activeCurrent = participants[safe]
    if (activeCurrent && pausedIds.has(activeCurrent.id)) {
      setCurrentIndex(nextActiveIndex(safe))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pausedIds, participants])

  const onPass = useCallback(() => {
    const current = participants[currentIndex]
    if (current) {
      onEvent?.('PASS', current)
      setUndoSnapshot({ currentIndex, passStreaks })
      setPassStreaks((prev) => ({ ...prev, [current.id]: (prev[current.id] ?? 0) + 1 }))
    }
    advanceTurn()
  }, [participants, currentIndex, passStreaks, onEvent, advanceTurn])

  // Called once a POUR is confirmed (simulated today; hardware STATUS:
  // POURED/HAS_DRINK later). app/drink-outcome: pass `{ advance: false }` to
  // log the pour but keep the turn on this person while they drink — the
  // caller then calls `advanceTurn()` once the outcome (Finished / Left
  // some / Tapon) is recorded. The undo snapshot is still taken here, at
  // pour time, so undoing afterwards returns the turn to the pourer either
  // way.
  const onPourConfirmed = useCallback(
    ({ advance = true } = {}) => {
      const current = participants[currentIndex]
      if (current) {
        onEvent?.('POUR', current)
        setUndoSnapshot({ currentIndex, passStreaks })
        setPassStreaks((prev) => ({ ...prev, [current.id]: 0 }))
      }
      if (advance) advanceTurn()
    },
    [participants, currentIndex, passStreaks, onEvent, advanceTurn],
  )

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
    advanceTurn,
    currentPassStreak,
    isOverPassLimit,
    canUndo: undoSnapshot !== null,
    undoTurn,
  }
}
