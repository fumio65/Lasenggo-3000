import { useSessionHistory } from './useSessionHistory'
import { BackIcon } from '../../shared/components/BackIcon'
import { HistoryIcon } from '../../shared/components/HistoryIcon'
import { CalendarIcon } from '../../shared/components/CalendarIcon'

/** app/history-list (UX pass: date/time icons): split out of the old
 * single combined formatDate — date and time each get their own small
 * icon now (CalendarIcon / HistoryIcon's clock face) instead of one
 * plain string, so SessionDateTime below can label them separately. */
function formatDateOnly(isoString) {
  return new Date(isoString).toLocaleDateString(undefined, { dateStyle: 'medium' })
}

function formatTimeOnly(isoString) {
  return new Date(isoString).toLocaleTimeString(undefined, { timeStyle: 'short' })
}

/** app/history-list (UX pass: "modern" compact row): a small, muted
 * icon+text pairing for a session's date and time — smaller than the old
 * plain-text date string, with a calendar/clock glyph in front of each
 * so the two numbers read as "a date" and "a time" at a glance instead
 * of one undifferentiated string. Used both as the primary line for an
 * unnamed session (where there's no name to be the eye-catcher — see the
 * icon-tile addition just above this) and as the subline under a named
 * one. */
function SessionDateTime({ iso }) {
  return (
    <span className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11px] text-paper-dim">
      <span className="flex items-center gap-1">
        <CalendarIcon className="h-3 w-3 shrink-0" />
        {formatDateOnly(iso)}
      </span>
      <span className="flex items-center gap-1">
        <HistoryIcon className="h-3 w-3 shrink-0" />
        {formatTimeOnly(iso)}
      </span>
    </span>
  )
}

/**
 * Past sessions screen — date and participant count per session, newest
 * first, pulled from local SQLite (`app/history-list`). Tapping a row opens
 * `HistoryDetail` via `onSelect` (`app/history-detail`).
 */
export function HistoryList({ onBack, onSelect }) {
  const { sessions, loading, syncedFromCloud } = useSessionHistory()

  return (
    <div className="min-h-screen bg-ink text-paper p-6">
      <div className="mx-auto max-w-md space-y-6">
        {/* app/history-sticky-back: a long session list scrolls the whole
            page (no own ScrollFadeBox — this list is meant to show
            everything), and the Back button used to live inline in the
            header, so it scrolled away with it — reported as "the back
            button disappears". Pulled into its own sticky bar, pinned to
            the top of the viewport (`-mx-6 -mt-6` cancels this page's own
            `p-6` so the bar bleeds to the real edges, then re-adds its own
            padding) with a solid `bg-ink` so scrolling content doesn't
            show through underneath it. Only the button is sticky, not
            the title below it — a floating button with no header card
            around it is the familiar mobile pattern, and keeping the
            big title in normal flow avoids permanently reserving that
            much vertical space just to keep one button in view. */}
        <div className="sticky top-0 z-10 -mx-6 -mt-6 bg-ink px-6 pb-3 pt-6">
          <button
            type="button"
            onClick={onBack}
            aria-label="Back"
            className="flex items-center gap-1.5 rounded-full bg-smoke px-3 py-1.5 text-sm text-paper-dim ring-1 ring-smoke-light transition hover:bg-smoke-light hover:text-paper active:scale-95"
          >
            <BackIcon /> Back
          </button>
        </div>

        <header className="space-y-3">
          <div className="flex items-center justify-between">
            <h1 className="font-display text-2xl font-semibold tracking-tight">
              Session history
            </h1>
            {/* app/history-sync-fallback: lets offline/local-only mode be eyeballed
                during testing; harmless to leave as a quiet status indicator. */}
            {!loading && (
              <span className="rounded-full bg-smoke px-2 py-0.5 text-[10px] text-paper-dim">
                {syncedFromCloud ? 'synced' : 'local only'}
              </span>
            )}
          </div>
        </header>

        {loading ? (
          <ul className="space-y-2" aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <li key={i} className="h-14 animate-pulse rounded-xl bg-smoke" />
            ))}
          </ul>
        ) : sessions.length === 0 ? (
          <div className="rounded-xl border border-dashed border-smoke-light px-4 py-8 text-center text-sm text-paper-dim">
            <HistoryIcon className="mx-auto mb-2 h-5 w-5 opacity-40" />
            No sessions yet. Start one to see it here.
          </div>
        ) : (
          <ul className="space-y-2">
            {sessions.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => onSelect(s.id)}
                  className="flex w-full items-center gap-3 rounded-xl bg-smoke px-4 py-3 text-left transition hover:bg-smoke-light active:scale-[0.99]"
                >
                  {/* app/history-list (UX pass): an unnamed session's row
                      is just its date/time as plain text — fine on its
                      own, but a long list of them (most sessions skip
                      naming) reads as a wall of near-identical text with
                      nothing to anchor the eye per row. A named session
                      doesn't have this problem (the name itself is what
                      the eye catches), so this icon tile only shows up
                      when there's no name to do that job instead — reuses
                      HistoryIcon rather than adding a new glyph, since
                      it's already this app's "a past session" symbol
                      (empty-state above, the nav button that gets here). */}
                  {!s.name && (
                    <span
                      aria-hidden="true"
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink ring-1 ring-smoke-light"
                    >
                      <HistoryIcon className="h-4 w-4 text-paper-dim" />
                    </span>
                  )}
                  <span className="min-w-0 flex-1 space-y-0.5">
                    {/* app/session-naming: a custom name is still the
                        primary line when there is one — the date/time
                        row (always shown now, named or not) demotes to a
                        subline underneath it instead of disappearing. */}
                    {s.name && (
                      <span className="block truncate text-paper">{s.name}</span>
                    )}
                    <SessionDateTime iso={s.started_at} />
                  </span>
                  <span className="shrink-0 pl-3 text-sm text-paper-dim">
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
