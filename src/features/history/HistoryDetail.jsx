import { useSessionDetail } from './useSessionDetail'

function formatDate(isoString) {
  return new Date(isoString).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

/**
 * Per-participant drink/pass counts for one past session (`app/history-detail`).
 * Counts come straight from the local `events` table — no separate aggregate
 * is stored anywhere (per ARCHITECTURE.md's "event log, not aggregate-only"
 * design pattern).
 */
export function HistoryDetail({ sessionId, onBack }) {
  const { detail, loading } = useSessionDetail(sessionId)

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 p-6">
      <div className="mx-auto max-w-md space-y-6">
        <header className="space-y-1">
          <button
            type="button"
            onClick={onBack}
            className="text-sm text-neutral-500 hover:text-neutral-300"
          >
            ← Back to history
          </button>
          <h1 className="text-2xl font-bold tracking-tight">
            {loading || !detail?.session
              ? 'Session'
              : detail.session.name || formatDate(detail.session.started_at)}
          </h1>
          {/* app/session-naming: show the date as a subline too once a session
              has a custom name, so it's not lost from view */}
          {!loading && detail?.session?.name && (
            <p className="text-sm text-neutral-500">{formatDate(detail.session.started_at)}</p>
          )}
        </header>

        {loading ? (
          <p className="text-center text-sm text-neutral-500">Loading…</p>
        ) : !detail?.participants.length ? (
          <p className="rounded-lg border border-dashed border-neutral-800 px-4 py-8 text-center text-sm text-neutral-500">
            No participants recorded for this session.
          </p>
        ) : (
          <ul className="space-y-2">
            {detail.participants.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between rounded-lg bg-neutral-900 px-4 py-3"
              >
                <span className="text-neutral-100">{p.name}</span>
                <span className="flex gap-3 text-sm text-neutral-500">
                  <span>{p.pour_count} poured</span>
                  <span>{p.pass_count} passed</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
