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
 */
export function useTurnManager(participants, { onEvent } = {}) {
  const [currentIndex, setCurrentIndex] = useState(0)

  const advanceTurn = useCallback(() => {
    setCurrentIndex((prev) =>
      participants.length === 0 ? 0 : (prev + 1) % participants.length
    )
  }, [participants.length])

  const onPass = useCallback(() => {
    const current = participants[currentIndex]
    if (current) onEvent?.('PASS', current)
    advanceTurn()
  }, [participants, currentIndex, onEvent, advanceTurn])

  // Called once a POUR is confirmed by hardware (STATUS: POURED/HAS_DRINK).
  // Not reachable from the UI yet — app/ble-commands + app/ble-status-subscription
  // need to exist first to produce that confirmation.
  const onPourConfirmed = useCallback(() => {
    const current = participants[currentIndex]
    if (current) onEvent?.('POUR', current)
    advanceTurn()
  }, [participants, currentIndex, onEvent, advanceTurn])

  const safeIndex = currentIndex % Math.max(participants.length, 1)

  return {
    currentIndex: safeIndex,
    current: participants[safeIndex],
    onPass,
    onPourConfirmed,
  }
}
