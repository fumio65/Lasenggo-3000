import { useTurnManager } from './useTurnManager'

/**
 * Active session screen.
 *
 * Turn order now advances for real on Pass (`app/turn-manager`, this task).
 * Two things remain intentionally stubbed, matching separate TASKS.md items:
 *  - Pour stays disabled — it needs an actual BLE connection/command
 *    (`app/ble-connect`, `app/ble-commands`) and a confirmed STATUS reply
 *    before `onPourConfirmed` should ever run.
 *  - The status indicator shows a fixed "Not connected" state — real STATUS
 *    values from the ESP32 arrive via `app/ble-status-subscription`.
 *  - Pass/Pour events aren't persisted yet — that's `app/local-event-logging`.
 */
export function ActiveSessionScreen({ participants, onExit }) {
  const { current, onPass } = useTurnManager(participants)

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

        <div className="flex items-center gap-2 rounded-full bg-neutral-900 px-4 py-1.5 text-xs font-medium uppercase tracking-wide text-neutral-400">
          <span className="h-2 w-2 rounded-full bg-neutral-600" />
          Not connected
        </div>

        <div className="text-center">
          <p className="text-sm text-neutral-500">Current turn</p>
          <h1 className="text-4xl font-bold tracking-tight">{current?.name ?? '—'}</h1>
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

        <p className="text-center text-xs text-neutral-600">
          {participants.length} participant{participants.length === 1 ? '' : 's'} in
          this round · event logging and BLE connection are wired up in later tasks
        </p>
      </div>
    </div>
  )
}
