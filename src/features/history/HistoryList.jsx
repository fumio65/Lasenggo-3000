import { useRef, useState } from 'react'
import { useSessionHistory } from './useSessionHistory'
import { deleteSession } from '../storage/sessionQueries'
import { BackIcon } from '../../shared/components/BackIcon'
import { HistoryIcon } from '../../shared/components/HistoryIcon'
import { CalendarIcon } from '../../shared/components/CalendarIcon'
import { PeopleIcon } from '../../shared/components/PeopleIcon'
import { HashtagIcon } from '../../shared/components/HashtagIcon'
import { TrashIcon } from '../../shared/components/TrashIcon'

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
    <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm text-paper-dim">
      <span className="flex items-center gap-1">
        <CalendarIcon className="h-4 w-4 shrink-0" />
        {formatDateOnly(iso)}
      </span>
      <span className="flex items-center gap-1">
        <HistoryIcon className="h-4 w-4 shrink-0" />
        {formatTimeOnly(iso)}
      </span>
    </span>
  )
}

// app/history-swipe-delete: how far (px) a row slides left to reveal the
// delete button fully behind it. Also doubles as the drag range clamp and
// the "did they drag past the halfway point" open/close threshold.
const SWIPE_REVEAL_PX = 76

/**
 * app/history-swipe-delete: one swipeable session row — tracks its own
 * drag gesture with raw pointer events (no gesture library; this app has
 * none installed and the gesture is simple enough not to need one) and
 * reports back to the parent list only the two things it needs to know:
 * which row is "open" (so opening a new one can close whichever was open
 * before — only one revealed at a time, the familiar swipe-list
 * convention) and when the delete button itself was tapped.
 *
 * Pointer handling, not touch-event handling, so the same code drives
 * mouse-drag testing in a desktop browser and real touch on a phone.
 * `axis` locks in on the first few pixels of movement (`>6px`) to tell a
 * horizontal swipe apart from the user just scrolling the page
 * vertically — once locked to 'y' this row stops reading the gesture at
 * all for the rest of it, so a vertical scroll through a list of rows
 * never gets fought over or stutters. `moved` suppresses the row's own
 * tap/select handler right after an actual drag, so releasing a swipe
 * doesn't also count as "tap to open this session".
 */
function SwipeableSessionRow({ s, isOpen, onOpenChange, onSelect, onRequestDelete }) {
  const [dragX, setDragX] = useState(null) // null = not actively dragging
  const gestureRef = useRef({ startX: 0, startY: 0, baseX: 0, axis: null, moved: false })

  const openOffset = isOpen ? -SWIPE_REVEAL_PX : 0
  const offset = dragX != null ? dragX : openOffset

  function handlePointerDown(e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    gestureRef.current = { startX: e.clientX, startY: e.clientY, baseX: openOffset, axis: null, moved: false }
  }

  function handlePointerMove(e) {
    const g = gestureRef.current
    if (g.axis === 'y') return
    const dx = e.clientX - g.startX
    const dy = e.clientY - g.startY
    if (g.axis == null) {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return
      g.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'
      if (g.axis === 'y') return
    }
    g.moved = true
    const next = Math.min(0, Math.max(-SWIPE_REVEAL_PX, g.baseX + dx))
    setDragX(next)
  }

  function endDrag() {
    const g = gestureRef.current
    if (g.axis === 'x') {
      const current = dragX ?? openOffset
      onOpenChange(current <= -SWIPE_REVEAL_PX / 2)
    }
    setDragX(null)
  }

  function handleRowClick() {
    const g = gestureRef.current
    if (g.moved) {
      // That click was the tail end of a drag release, not a real tap —
      // swallow it once, then clear the flag.
      g.moved = false
      return
    }
    if (isOpen) {
      onOpenChange(false)
      return
    }
    onSelect(s.id)
  }

  return (
    <li className="relative overflow-hidden rounded-xl">
      {/* Delete button, sitting behind the row the whole time — only
          visible once the row above slides left to reveal it. Not a
          popup, not a second tap away: this is the "warning dialog"
          trigger, not the delete itself (see onRequestDelete). */}
      <div
        className="absolute inset-y-0 right-0 flex items-stretch"
        style={{ width: `${SWIPE_REVEAL_PX}px` }}
      >
        <button
          type="button"
          onClick={() => {
            onOpenChange(false)
            onRequestDelete(s)
          }}
          aria-label={`Delete ${s.name || 'this session'}`}
          className="flex w-full items-center justify-center rounded-xl bg-maroon text-paper transition active:brightness-90"
        >
          <TrashIcon className="h-5 w-5" />
        </button>
      </div>

      <button
        type="button"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onClick={handleRowClick}
        style={{
          transform: `translateX(${offset}px)`,
          transition:
            dragX != null
              ? 'none'
              : 'transform 240ms cubic-bezier(0.22, 1, 0.36, 1), background-color 150ms ease',
          touchAction: 'pan-y',
        }}
        className="relative flex w-full items-center gap-3 rounded-xl bg-smoke px-4 py-3 text-left hover:bg-smoke-light"
      >
        <span className="min-w-0 flex-1 space-y-0.5">
          {/* app/session-naming: a custom name is still the primary line
              when there is one — the date/time row (always shown now,
              named or not) demotes to a subline underneath it instead of
              disappearing. */}
          {s.name && (
            <span className="flex items-center gap-1.5 text-paper">
              <HashtagIcon className="h-5 w-5 shrink-0 text-paper-dim" />
              <span className="truncate">{s.name}</span>
            </span>
          )}
          <SessionDateTime iso={s.started_at} />
        </span>
        {/* app/history-list (UX pass): "N participants" as a text label
            took more width than the number itself warranted, especially
            next to the now-compact date/time row. A PeopleIcon + bare
            count reads just as clearly at a glance and matches the
            icon-led style the date/time row already uses. */}
        <span className="flex shrink-0 items-center gap-1 pl-3 text-sm text-paper-dim">
          <PeopleIcon className="h-3.5 w-3.5 shrink-0" />
          {s.participant_count}
        </span>
      </button>
    </li>
  )
}

/**
 * Past sessions screen — date and participant count per session, newest
 * first, pulled from local SQLite (`app/history-list`). Tapping a row opens
 * `HistoryDetail` via `onSelect` (`app/history-detail`).
 *
 * app/history-swipe-delete: swipe a row left to reveal a delete button
 * (SwipeableSessionRow above handles the gesture itself); tapping that
 * button opens the confirm dialog below rather than deleting right away
 * — deleting a whole session's history has no undo, so the swipe only
 * ever *arms* the delete, it never performs it.
 */
export function HistoryList({ onBack, onSelect }) {
  const { sessions, loading, removeSession, syncedFromCloud } = useSessionHistory()
  const [openSwipeId, setOpenSwipeId] = useState(null)
  const [confirmSession, setConfirmSession] = useState(null)
  const [deleting, setDeleting] = useState(false)

  async function handleConfirmDelete() {
    if (!confirmSession) return
    setDeleting(true)
    try {
      await deleteSession(confirmSession.id)
      removeSession(confirmSession.id)
      setConfirmSession(null)
    } catch (err) {
      console.error('Failed to delete session', err)
    } finally {
      setDeleting(false)
    }
  }

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
          {!loading && sessions.length > 0 && (
            <p className="text-xs text-paper-dim">Swipe a session left to delete it.</p>
          )}
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
              <SwipeableSessionRow
                key={s.id}
                s={s}
                isOpen={openSwipeId === s.id}
                onOpenChange={(open) => setOpenSwipeId(open ? s.id : null)}
                onSelect={onSelect}
                onRequestDelete={setConfirmSession}
              />
            ))}
          </ul>
        )}
      </div>

      {/* app/history-swipe-delete: the actual warning dialog — this, not
          the swipe, is the only thing that can trigger deleteSession.
          Always a deliberate second step: the swipe arms it, this
          confirms it. No exit animation (not mounted until there's
          something to confirm) since the ask was for the swipe to be
          smooth, not this. */}
      {confirmSession && (
        <div
          className="fixed inset-0 z-30 flex items-end justify-center bg-ink/70 p-4 backdrop-blur-sm sm:items-center"
          onClick={() => !deleting && setConfirmSession(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md space-y-3 rounded-2xl bg-smoke p-5 ring-1 ring-smoke-light"
          >
            <h2 className="font-display text-base font-semibold text-paper">Delete this session?</h2>
            <p className="text-sm text-paper-dim">
              Permanently deletes{' '}
              <span className="text-paper">
                {confirmSession.name || formatDateOnly(confirmSession.started_at)}
              </span>{' '}
              and everything in it — participants, pours, drinks. This can't be undone.
            </p>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setConfirmSession(null)}
                disabled={deleting}
                className="flex-1 rounded-xl px-3 py-2 text-sm font-semibold text-paper ring-1 ring-smoke-light transition hover:bg-smoke-light active:scale-95 disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={deleting}
                className="flex-1 rounded-xl bg-maroon px-3 py-2 text-sm font-semibold text-paper transition active:scale-95 disabled:opacity-40"
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
