import { useEffect, useState } from 'react'
import { useTurnManager } from './useTurnManager'
import { usePourVolume } from '../pour/usePourVolume'
import { PourVolumeSelector } from '../pour/PourVolumeSelector'
import { logEvent, deleteEvent, countEvents } from '../storage/sessionQueries'

/**
 * Active session screen.
 *
 * Pass advances turn order for real (`app/turn-manager`) and now logs a PASS
 * event row to local SQLite (`app/local-event-logging`, this task). Still
 * intentionally stubbed, matching separate TASKS.md items:
 *  - Pour stays disabled — needs an actual BLE connection/command
 *    (`app/ble-connect`, `app/ble-commands`) and a confirmed STATUS reply
 *    before `onPourConfirmed` should ever run (it will log a POUR event the
 *    same way once that's wired).
 *  - The status indicator shows a fixed "Not connected" state — real STATUS
 *    values from the ESP32 arrive via `app/ble-status-subscription`.
 */
export function ActiveSessionScreen({ participants, sessionId, sessionName, passLimit, onExit }) {
  // Temporary debug readout — remove once app/history-list exists to show
  // logged events properly.
  const [eventCount, setEventCount] = useState(0)
  useEffect(() => {
    if (sessionId) countEvents(sessionId).then(setEventCount)
  }, [sessionId])

  // app/undo-last-action: the event this device most recently logged, kept
  // just long enough to undo it (one level only — cleared once undone or
  // once the next action happens, since the snapshot below is one-level too).
  const [lastEvent, setLastEvent] = useState(null)

  const { current, onPass, currentPassStreak, isOverPassLimit, canUndo, undoTurn } =
    useTurnManager(participants, {
      passLimit,
      onEvent: (type, participant) => {
        logEvent(sessionId, participant.id, type)
          .then((eventId) => {
            setLastEvent({ id: eventId, type, participant })
            return countEvents(sessionId).then(setEventCount)
          })
          .catch((err) => console.error(`Failed to log ${type} event`, err))
      },
    })
  const { volumeId, setVolumeId } = usePourVolume()

  function handleUndo() {
    if (!canUndo || !lastEvent) return
    undoTurn()
    deleteEvent(lastEvent.id)
      .then(() => countEvents(sessionId).then(setEventCount))
      .catch((err) => console.error('Failed to delete undone event', err))
    setLastEvent(null)
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 p-6">
      <div className="mx-auto flex max-w-md flex-col items-center gap-8 pt-12">
        <button
          type="button"
          onClick={onExit}
          className="self-start text-sm text-neutral-500 hover:text-neutral-300"
        >
          ← Back to participants
        </button>

        {/* app/session-naming: only rendered when a name was given at
            Start Session — a blank name stays date-only everywhere else too */}
        {sessionName && (
          <h2 className="text-lg font-semibold text-neutral-300">{sessionName}</h2>
        )}

        <div className="flex items-center gap-2 rounded-full bg-neutral-900 px-4 py-1.5 text-xs font-medium uppercase tracking-wide text-neutral-400">
          <span className="h-2 w-2 rounded-full bg-neutral-600" />
          Not connected
        </div>

        <div className="text-center">
          <p className="text-sm text-neutral-500">Current turn</p>
          <h1 className="text-4xl font-bold tracking-tight">{current?.name ?? '—'}</h1>
        </div>

        {/* app/pass-limit-house-rule: soft warning only — Pass stays enabled.
            Pour would be the "real" next step once it works for real. */}
        {isOverPassLimit && (
          <p className="rounded-lg bg-amber-950/40 px-4 py-2 text-center text-sm text-amber-400 ring-1 ring-amber-700/50">
            House rule: {current?.name} has passed {currentPassStreak}x in a row
          </p>
        )}

        <div className="w-full space-y-2">
          <p className="text-center text-xs text-neutral-500">Pour volume</p>
          <PourVolumeSelector volumeId={volumeId} onChange={setVolumeId} />
        </div>

        <div className="grid w-full grid-cols-2 gap-4">
          <button
            type="button"
            disabled
            title="Needs BLE connection — app/ble-commands"
            className="rounded-xl bg-neutral-100 px-6 py-5 text-lg font-semibold text-neutral-950 disabled:opacity-30"
          >
            Pour
          </button>
          <button
            type="button"
            onClick={onPass}
            className="rounded-xl bg-neutral-800 px-6 py-5 text-lg font-semibold text-neutral-100 transition hover:bg-neutral-700"
          >
            Pass
          </button>
        </div>

        {/* app/undo-last-action: only one level deep, and only for the
            event this device itself just logged — not a history stack. */}
        {canUndo && lastEvent && (
          <button
            type="button"
            onClick={handleUndo}
            className="text-xs text-neutral-500 underline-offset-2 hover:text-neutral-300 hover:underline"
          >
            Undo: {lastEvent.type === 'POUR' ? 'Pour' : 'Pass'} by {lastEvent.participant.name}
          </button>
        )}

        <p className="text-center text-xs text-neutral-600">
          {participants.length} participant{participants.length === 1 ? '' : 's'} in
          this round · BLE connection wired up in a later task
        </p>
        <p className="text-center text-[10px] font-mono text-neutral-700">
          events logged this session: {eventCount}
        </p>
      </div>
    </div>
  )
}
