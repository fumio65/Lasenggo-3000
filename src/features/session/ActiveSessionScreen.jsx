/**
 * Active session screen shell.
 *
 * Scope note: this is deliberately a static shell, not the finished feature.
 * Two things are intentionally stubbed, matching separate TASKS.md items:
 *  - Whose turn it is doesn't advance yet — that's `app/turn-manager`
 *    ("circular order, advance on confirmed POUR or on PASS").
 *  - The status indicator shows a fixed "Not connected" state — real STATUS
 *    values from the ESP32 arrive via `app/ble-status-subscription`.
 * Pour/Pass are rendered disabled with a note rather than silently doing
 * nothing, so it's obvious in the UI itself that wiring is still pending.
 */
export function ActiveSessionScreen({ participants, onExit }) {
  const current = participants[0]

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
            disabled
            title="Turn advancing not wired yet — app/turn-manager"
            className="rounded-xl bg-neutral-800 px-6 py-5 text-lg font-semibold text-neutral-100 disabled:opacity-30"
          >
            Pass
          </button>
        </div>

        <p className="text-center text-xs text-neutral-600">
          {participants.length} participant{participants.length === 1 ? '' : 's'} in
          this round · turn order and BLE connection are wired up in later tasks
        </p>
      </div>
    </div>
  )
}
