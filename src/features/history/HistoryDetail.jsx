import { useState } from 'react'
import { useSessionDetail } from './useSessionDetail'
import { deleteSession } from '../storage/sessionQueries'
import { BackIcon } from '../../shared/components/BackIcon'
import { TrashIcon } from '../../shared/components/TrashIcon'
import { PlayIcon } from '../../shared/components/PlayIcon'
import { HistoryIcon } from '../../shared/components/HistoryIcon'
import { ParticipantStatBar, VolumeLegend, VOLUME_BY_ID } from '../../shared/components/ParticipantStatBar'
import { ScrollFadeBox } from '../../shared/components/ScrollFadeBox'
import { ActivityFeed } from '../../shared/components/ActivityFeed'
import { formatVolumeMl } from '../pour/volumeUnits'
import { CalendarIcon } from '../../shared/components/CalendarIcon'
import { PeopleIcon } from '../../shared/components/PeopleIcon'
import { HashtagIcon } from '../../shared/components/HashtagIcon'

function formatDate(isoString) {
  return new Date(isoString).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

/** app/history-list (UX pass follow-up: separate time icon): formatDate
 * above bundles date+time into one string, which only leaves room for
 * one icon (CalendarIcon) in front of it - the time half had nothing of
 * its own, reported as "you didn't put the time icon on it". Split out
 * so HistoryDateTime below can give each half its own icon, same as
 * HistoryList's SessionDateTime already does. */
function formatDateOnly(isoString) {
  return new Date(isoString).toLocaleDateString(undefined, { dateStyle: 'medium' })
}

function formatTimeOnly(isoString) {
  return new Date(isoString).toLocaleTimeString(undefined, { timeStyle: 'short' })
}

function HistoryDateTime({ iso, size = 'h-4 w-4', className = 'text-sm text-paper-dim' }) {
  return (
    <span className={`flex flex-wrap items-center gap-x-2.5 gap-y-1 ${className}`}>
      <span className="flex items-center gap-1.5">
        <CalendarIcon className={`${size} shrink-0`} />
        {formatDateOnly(iso)}
      </span>
      <span className="flex items-center gap-1.5">
        <HistoryIcon className={`${size} shrink-0`} />
        {formatTimeOnly(iso)}
      </span>
    </span>
  )
}

/** Reshapes one SQL row from getSessionDetail (flat *_count columns) into
 * the { name, pass, totalMl, byVolume } shape ParticipantStatBar expects —
 * the same shape ActiveSessionScreen's SessionLog builds from raw events,
 * just aggregated server-side here instead of client-side from a live
 * event list, since a past session's data never changes under us. */
function toStat(row) {
  const byVolume = {
    light: row.light_count ?? 0,
    standard: row.standard_count ?? 0,
    heavy: row.heavy_count ?? 0,
  }
  const totalMl = Object.entries(byVolume).reduce(
    (sum, [volumeId, count]) => sum + count * (VOLUME_BY_ID[volumeId]?.approxMl ?? 0),
    0,
  )
  return { id: row.id, name: row.name, pass: row.pass_count ?? 0, totalMl, byVolume }
}

/** app/pause-reason-tag: whether each participant was still paused when
 * this session ended, and why — derived from the same PAUSE/RESUME events
 * the Activity log already shows, not a separate stored flag. `events` is
 * newest-first (getSessionEvents' own order), so the first PAUSE/RESUME
 * row found per participant while scanning it is their *last* one — if
 * that's a PAUSE, they never got a matching Resume before the session
 * ended (the "went home" / "ran away" case this was built for). */
function buildPausedAtEnd(events) {
  const result = {}
  const seen = new Set()
  for (const event of events) {
    if (event.type !== 'PAUSE' && event.type !== 'RESUME') continue
    if (seen.has(event.participant_id)) continue
    seen.add(event.participant_id)
    if (event.type === 'PAUSE') result[event.participant_id] = event.note || null
  }
  return result
}

/**
 * Per-participant pour/pass breakdown for one past session (`app/history-
 * detail`), using the same `ParticipantStatBar` visualization as the live
 * session's "Session log" panel — so a session reads the same way whether
 * it's happening right now or being looked back on. Counts come straight
 * from the local `events` table — no separate aggregate is stored anywhere
 * (per ARCHITECTURE.md's "event log, not aggregate-only" design pattern).
 *
 * Also shows how many people were in the round and the full chronological
 * activity log (shared `ActivityFeed`, same visualization as the live
 * session's "Activity log" — just the complete history instead of a
 * capped recent slice, since there's nothing new to scroll to here).
 */
/** app/drink-session-log (same formula ActiveSessionScreen's live
 * remainingForDrink uses, computed here from the already-loaded past-
 * session `events` instead of a live list): a drink's remaining volume —
 * its declared volume_ml minus every POUR event tagged with its id — or
 * null if no volume was declared. */
function remainingForDrink(drink, events) {
  if (drink.volume_ml == null) return null
  const pouredMl = events
    .filter((e) => e.type === 'POUR' && e.drink_id === drink.id)
    .reduce((sum, e) => sum + (VOLUME_BY_ID[e.volume]?.approxMl ?? 0), 0)
  return drink.volume_ml - pouredMl
}

/** app/drink-session-log (fix: queued-but-never-promoted/re-queued
 * drinks used to be filtered out of history entirely, see
 * getSessionDrinks): a drink's status alone doesn't say enough once a
 * session has ended — `'queued'` covers both "staged but never touched"
 * and "was poured from earlier, then re-queued and never promoted back"
 * (demoteCurrentDrink re-queues a non-empty drink on every switch-away).
 * Whether it has any POUR events disambiguates the two. */
function drinkStatusLabel(drink, events) {
  if (drink.status === 'serving') return 'Serving when ended'
  const wasPoured = events.some((e) => e.type === 'POUR' && e.drink_id === drink.id)
  if (drink.status === 'queued') return wasPoured ? 'Served, then re-queued' : 'Queued, never served'
  return 'Served'
}

export function HistoryDetail({ sessionId, onBack, onResume }) {
  const { detail, events, drinks, loading } = useSessionDetail(sessionId)
  // app/history-swipe-delete (detail-screen follow-up): same confirm-
  // then-delete pattern as HistoryList's swipe-to-delete, just reached
  // via a plain button here instead of a swipe gesture — a single
  // session's own overview isn't a list, so there's nothing to swipe.
  // Deleting navigates back to the list (onBack) rather than trying to
  // show an empty/broken detail view for a session that's gone.
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function handleConfirmDelete() {
    setDeleting(true)
    try {
      await deleteSession(sessionId)
      onBack()
    } catch (err) {
      console.error('Failed to delete session', err)
      setDeleting(false)
    }
  }

  const pausedAtEnd = buildPausedAtEnd(events)
  const stats = detail?.participants.map(toStat) ?? []
  const maxActions = Math.max(
    1,
    ...stats.map((s) => s.byVolume.light + s.byVolume.standard + s.byVolume.heavy + s.pass),
  )
  const participantCount = detail?.participants.length ?? 0

  return (
    <div className="min-h-screen bg-ink text-paper p-6">
      <div className="mx-auto max-w-md space-y-6">
        {/* app/history-sticky-back: this page can run long once Drinks
            and the full Activity log are showing, and the Back button
            used to scroll away with the rest of the header — reported
            as "the back button disappears". Same fix as HistoryList:
            pulled into its own sticky bar pinned to the top of the
            viewport, bleeding to the real page edges and painted over
            with `bg-ink` so scrolling content doesn't show through. */}
        <div className="sticky top-0 z-10 -mx-6 -mt-6 flex items-center justify-between bg-ink px-6 pb-3 pt-6">
          <button
            type="button"
            onClick={onBack}
            aria-label="Back to history"
            className="flex items-center gap-1.5 rounded-full bg-smoke px-3 py-1.5 text-sm text-paper-dim ring-1 ring-smoke-light transition hover:bg-smoke-light hover:text-paper active:scale-95"
          >
            <BackIcon /> Back
          </button>
          <button
            type="button"
            onClick={() => setConfirmingDelete(true)}
            aria-label="Delete this session"
            className="flex items-center gap-1.5 rounded-full bg-smoke px-3 py-1.5 text-sm text-paper-dim ring-1 ring-smoke-light transition hover:bg-maroon/20 hover:text-paper active:scale-95"
          >
            <TrashIcon className="h-4 w-4" /> Delete
          </button>
        </div>

        {/* app/history-list (UX pass: icon-led header, matching
            HistoryList's rows): the title/date/participant-count header
            used to be plain text — the list it's reached from already
            got calendar/clock/people/hashtag icons for the same three
            pieces of info, so this detail header picks up the same
            treatment instead of being the one screen left behind. */}
        <header className="space-y-2">
          {/* app/history-list (UX pass follow-up): a named session's
              h1 gets HashtagIcon + the name, with the date/time as an
              icon-led subline underneath (both halves now have their own
              icon via HistoryDateTime, not just the date). An unnamed
              session has no name to put in the h1 at all, so the h1
              itself becomes the date/time line instead of falling back
              to one plain icon + a combined string. */}
          <h1 className="flex flex-wrap items-center gap-x-2 gap-y-1 font-display text-2xl font-semibold tracking-tight">
            {loading || !detail?.session ? (
              <span>Session</span>
            ) : detail.session.name ? (
              <>
                <HashtagIcon className="h-5 w-5 shrink-0 text-paper-dim" />
                <span className="truncate">{detail.session.name}</span>
              </>
            ) : (
              <HistoryDateTime
                iso={detail.session.started_at}
                size="h-5 w-5"
                className="text-2xl font-semibold tracking-tight text-paper"
              />
            )}
          </h1>
          {/* app/session-naming: show the date/time as a subline too once
              a session has a custom name, so it's not lost from view. */}
          {!loading && detail?.session?.name && (
            <HistoryDateTime iso={detail.session.started_at} />
          )}
          {!loading && participantCount > 0 && (
            <p className="flex items-center gap-1.5 text-sm text-paper-dim">
              <PeopleIcon className="h-4 w-4 shrink-0" />
              {participantCount}
            </p>
          )}
        </header>

        {/* app/history-resume: a full-width CTA rather than another
            small icon crammed into the sticky bar above — resuming
            drops you straight back into a live session (reloading this
            session's roster and un-ending it), a bigger decision than
            Back/Delete, so it gets a button you can't miss instead of
            one you have to go looking for. Hidden while loading (no
            session to resume yet) and if the caller didn't wire up
            onResume at all. */}
        {!loading && detail?.session && onResume && (
          <button
            type="button"
            onClick={() => onResume(sessionId)}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-ember px-4 py-2.5 text-sm font-semibold text-ink transition active:scale-95"
          >
            <PlayIcon className="h-4 w-4" />
            Resume session
          </button>
        )}

        {loading ? (
          <ul className="space-y-3" aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <li key={i} className="space-y-1.5">
                <div className="h-3.5 w-24 animate-pulse rounded bg-smoke" />
                <div className="h-2.5 w-full animate-pulse rounded-full bg-smoke" />
              </li>
            ))}
          </ul>
        ) : !detail?.participants.length ? (
          <div className="rounded-xl border border-dashed border-smoke-light px-4 py-8 text-center text-sm text-paper-dim">
            <HistoryIcon className="mx-auto mb-2 h-5 w-5 opacity-40" />
            No participants recorded for this session.
          </div>
        ) : (
          <>
            <section className="space-y-3 rounded-2xl bg-smoke/60 p-4 ring-1 ring-smoke-light">
              <ScrollFadeBox maxHeightClassName="max-h-[28rem]" watch={stats.length}>
                <ul className="space-y-4">
                  {stats.map((stat) => (
                    <ParticipantStatBar
                      key={stat.id ?? stat.name}
                      stat={stat}
                      maxActions={maxActions}
                      isPaused={stat.id in pausedAtEnd}
                      pauseReason={pausedAtEnd[stat.id]}
                    />
                  ))}
                </ul>
              </ScrollFadeBox>
              <VolumeLegend />
            </section>

            {/* app/drink-tracking: manual log, oldest first — what was served
                and when it changed, same "show the full log" idea as the
                Activity log below. Hidden entirely for a session that
                never used drink tracking. */}
            {drinks.length > 0 && (
              <section className="rounded-2xl bg-smoke/60 p-4 ring-1 ring-smoke-light">
                <h2 className="font-display text-xs font-semibold text-paper-dim">Drinks</h2>
                {/* app/drink-session-log (UX pass: small-multiples bar
                    chart instead of plain text rows; fix: bar direction
                    inverted from the live view): each drink with a
                    declared volume gets a thin horizontal bar, oldest
                    drink on top (drinks is already ASC by started_at,
                    so reading top-to-bottom reads as reading forward
                    through the session). The bar fills with *remaining*
                    volume and drains as more gets poured — not the
                    other way around — specifically to match the live
                    session's own "Now serving" depletion bar
                    (ActiveSessionScreen: barWidthPct = remainingMl /
                    declared), so a drink reads the same way whether the
                    session is happening now or being looked back on. An
                    earlier version of this bar filled *up* with poured
                    amount instead, which was consistent with nothing —
                    not the live bar, and arguably the less intuitive
                    direction anyway (a draining gauge is the familiar
                    "how much is left" convention; a filling-up progress
                    bar reads as "how much is done", which isn't the
                    question history answers). Every number is also a
                    direct text label (poured/declared, remaining) — the
                    bar is a magnitude cue on top of the numbers, never
                    the only way to read them. A drink logged with no
                    declared volume has no baseline to bar against, so
                    it falls back to the plain status line alone. */}
                <ul className="mt-3 space-y-3">
                  {drinks.map((drink) => {
                    const remaining = remainingForDrink(drink, events)
                    const hasVolume = drink.volume_ml != null
                    const pouredMl = hasVolume ? drink.volume_ml - Math.max(remaining, 0) : null
                    const isEmpty = remaining != null && remaining <= 0
                    const widthPct = hasVolume && drink.volume_ml > 0
                      ? Math.min(Math.max((Math.max(remaining, 0) / drink.volume_ml) * 100, 0), 100)
                      : 0
                    return (
                      <li key={drink.id} className="space-y-1">
                        <div className="flex items-baseline justify-between gap-3 text-sm">
                          <span className="truncate text-paper">{drink.name}</span>
                          <span className="shrink-0 text-xs text-paper-dim">{formatDate(drink.started_at)}</span>
                        </div>
                        {hasVolume && (
                          <div className="h-2 w-full overflow-hidden rounded-full bg-ink">
                            <div
                              className={`h-full rounded-full ${isEmpty ? 'bg-maroon' : 'bg-ember'}`}
                              style={{ width: `${widthPct}%` }}
                            />
                          </div>
                        )}
                        <p className="text-xs text-paper-dim">
                          {drinkStatusLabel(drink, events)}
                          {hasVolume && (
                            <>
                              {' · '}
                              {formatVolumeMl(pouredMl)} poured of {formatVolumeMl(drink.volume_ml)}
                              {remaining != null && !isEmpty && ` (${formatVolumeMl(remaining)} left)`}
                            </>
                          )}
                        </p>
                      </li>
                    )
                  })}
                </ul>
              </section>
            )}

            <section className="rounded-2xl bg-smoke/60 p-4 ring-1 ring-smoke-light">
              <h2 className="font-display text-xs font-semibold text-paper-dim">Activity log</h2>
              <ActivityFeed
                events={events}
                emptyMessage="No pours or passes were logged for this session."
                maxHeightClassName="max-h-80"
              />
            </section>
          </>
        )}
      </div>

      {/* app/history-swipe-delete (detail-screen follow-up): same warning
          dialog copy/shape as HistoryList's, this screen's own trigger. */}
      {confirmingDelete && (
        <div
          className="fixed inset-0 z-30 flex items-end justify-center bg-ink/70 p-4 backdrop-blur-sm sm:items-center"
          onClick={() => !deleting && setConfirmingDelete(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md space-y-3 rounded-2xl bg-smoke p-5 ring-1 ring-smoke-light"
          >
            <h2 className="font-display text-base font-semibold text-paper">Delete this session?</h2>
            <p className="text-sm text-paper-dim">
              Permanently deletes{' '}
              <span className="text-paper">
                {detail?.session?.name || (detail?.session && formatDate(detail.session.started_at))}
              </span>{' '}
              and everything in it — participants, pours, drinks. This can't be undone.
            </p>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setConfirmingDelete(false)}
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
