import { useSessionHistory } from './useSessionHistory'

function formatDate(isoString) {
  return new Date(isoString).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

/**
 * Past sessions screen — date and participant count per session, newest
 * first, pulled from local SQLite (`app/history-list`). Tapping a row opens
 * `HistoryDetail` via `onSelect` (`app/history-detail`).
 */
export function HistoryList({ onBack, onSelect }) {
  const { sessions, loading, syncedFromCloud } = useSessionHistory()

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 p-6">
      <div className="mx-auto max-w-md space-y-6">
        <header className="space-y-1">
          <button
            type="button"
            onClick={onBack}
            className="text-sm text-neutral-500 hover:text-neutral-300"
          >
            ← Back
          </button>
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold tracking-tight">Session History</h1>
            {/* app/history-sync-fallback: lets offline/local-only mode be eyeballed
                during testing; harmless to leave as a quiet status indicator. */}
            {!loading && (
              <span className="text-[10px] font-mono text-neutral-600">
                {syncedFromCloud ? 'synced' : 'local only'}
              </span>
            )}
          </div>
        </header>

        {loading ? (
          <p className="text-center text-sm text-neutral-500">Loading…</p>
        ) : sessions.length === 0 ? (
          <p className="rounded-lg border border-dashed border-neutral-800 px-4 py-8 text-center text-sm text-neutral-500">
            No sessions yet. Start one to see it here.
          </p>
        ) : (
          <ul className="space-y-2">
            {sessions.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => onSelect(s.id)}
                  className="flex w-full items-center justify-between rounded-lg bg-neutral-900 px-4 py-3 text-left transition hover:bg-neutral-800"
                >
                  <span className="text-neutral-100">{formatDate(s.started_at)}</span>
                  <span className="text-sm text-neutral-500">
                    {s.participant_count} participant{s.participant_count === 1 ? '' : 's'}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
