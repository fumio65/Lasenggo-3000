import { VOLUME_BY_ID } from './ParticipantStatBar'
import { ScrollFadeBox } from './ScrollFadeBox'
import { describeOutcome } from '../../features/pour/drinkOutcome'

export function formatClockTime(isoString) {
  return new Date(isoString).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  })
}

// app/drink-outcome (activity tags): every pour and pass gets one tag that
// says what the turn amounted to: the pour size the person drank (Light /
// Standard / Heavy, in the same colors as the stat bar), Tapon if they
// threw it out, or Pass. Tags sit outside the truncating text, so they're
// never cut off in the narrow session panel. A pour still waiting on its
// outcome, or from before outcomes existed, shows its size.
const TAG_STYLES = {
  light: 'bg-pour-light/15 text-pour-light ring-pour-light/40',
  standard: 'bg-ember/15 text-ember ring-ember/40',
  heavy: 'bg-pour-heavy/20 text-pour-heavy ring-pour-heavy/40',
  tapon: 'bg-maroon/20 text-maroon-dim ring-maroon/40',
  pass: 'bg-smoke-light/60 text-paper-dim ring-smoke-light',
  timeout: 'bg-maroon/20 text-maroon-dim ring-maroon/40',
}

const DOT_STYLES = {
  light: 'bg-pour-light',
  standard: 'bg-ember',
  heavy: 'bg-pour-heavy',
  tapon: 'bg-maroon-dim',
  pass: 'bg-paper-dim/50',
  timeout: 'bg-maroon-dim',
}

function tagFor(event) {
  if (event.type === 'PASS') return { key: 'pass', label: 'Pass' }
  // app/turn-timer: logged when the turn timer runs out on someone.
  if (event.type === 'TIMEOUT') return { key: 'timeout', label: "Time's up" }
  if (event.type !== 'POUR') return null
  if (event.outcome === 'tapon') return { key: 'tapon', label: 'Tapon' }
  const volume = VOLUME_BY_ID[event.volume]
  return volume ? { key: volume.id, label: volume.label } : null
}

const isAction = (e) => e.type === 'POUR' || e.type === 'PASS'

/**
 * app/turn-timer (merged timeouts): a TIMEOUT belongs to the turn it
 * happened in, so the feed folds it into that turn's POUR/PASS row instead
 * of showing a separate line. Display only: TIMEOUT stays its own row in
 * the database. `events` is newest-first (getSessionEvents order); so is
 * the result.
 *
 * Which row a timeout joins, looking at POUR/PASS rows only:
 * - the action right before it, if that was the same person's POUR: time
 *   ran out while they were still drinking (outcome pending);
 * - otherwise the action right after it, if that's by the same person:
 *   time ran out before they poured or passed.
 * If neither fits (they haven't acted yet, or the session ended first),
 * it stays a standalone "ran out of time" row. Running this twice is safe.
 */
export function mergeTimeouts(events) {
  const chrono = events.slice().reverse()
  const attached = new Map() // action event id -> timeout event
  const absorbed = new Set() // timeout ids folded into an action

  chrono.forEach((event, i) => {
    if (event.type !== 'TIMEOUT') return
    let prev = null
    for (let j = i - 1; j >= 0; j -= 1) if (isAction(chrono[j])) { prev = chrono[j]; break }
    let next = null
    for (let j = i + 1; j < chrono.length; j += 1) if (isAction(chrono[j])) { next = chrono[j]; break }
    const target =
      prev && prev.type === 'POUR' && prev.participant_id === event.participant_id
        ? prev
        : next && next.participant_id === event.participant_id
          ? next
          : null
    if (target && !attached.has(target.id) && !target.timedOut) {
      attached.set(target.id, event)
      absorbed.add(event.id)
    }
  })

  if (absorbed.size === 0) return events
  return events
    .filter((e) => !absorbed.has(e.id))
    .map((e) => (attached.has(e.id) ? { ...e, timedOut: attached.get(e.id).note || true } : e))
}

function describe(event) {
  if (event.type === 'POUR') {
    // The tag carries the size and the outcome; the text only adds the
    // drink's name and, for a measured partial (load cell, later), how much
    // was left.
    const parts = ['poured']
    if (event.drink_name) parts.push(event.drink_name)
    const outcome = describeOutcome(event)
    if (outcome) parts.push(outcome)
    return parts.join(' · ')
  }
  if (event.type === 'PASS') return 'passed'
  if (event.type === 'PAUSE') return `paused${event.note ? ` (${event.note})` : ''}`
  if (event.type === 'RESUME') return 'resumed'
  if (event.type === 'TIMEOUT') return `ran out of time${event.note ? ` (${event.note})` : ''}`
  return ''
}

/**
 * Chronological pour/pass feed — one colored dot + name + action + tag +
 * clock time per event. Shared between the live session's "Activity log"
 * (ActiveSessionScreen/SessionLog, a capped recent slice that auto-scrolls
 * to the newest entry) and a past session's full "Activity log"
 * (HistoryDetail, the complete history, nothing to auto-scroll to) so the
 * two read the same way whether the session is happening now or already
 * over.
 */
export function ActivityFeed({
  events,
  emptyMessage = 'Nothing logged yet — pours and passes will show up here as they happen.',
  maxHeightClassName = 'max-h-56',
  autoScrollToNewest = false,
}) {
  if (events.length === 0) {
    return <p className="mt-2 text-sm text-paper-dim">{emptyMessage}</p>
  }
  const rows = mergeTimeouts(events)

  return (
    <div className="mt-2">
      <ScrollFadeBox
        maxHeightClassName={maxHeightClassName}
        watch={rows.length}
        resetScrollKey={autoScrollToNewest ? rows[0]?.id : undefined}
      >
        <ul className="space-y-1.5">
          {rows.map((event) => {
            const tag = tagFor(event)
            const dot = tag ? DOT_STYLES[tag.key] : event.type === 'PAUSE' ? 'bg-maroon-dim' : 'bg-paper-dim/50'
            return (
              <li
                key={event.id}
                className="flex items-start gap-2 rounded-lg px-2 py-1.5 text-sm animate-[log-enter_220ms_ease-out]"
              >
                <span aria-hidden="true" className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} />
                {/* Wraps instead of truncating: on a phone the panel is too
                    narrow for "Name poured · Drink name" on one line, and a
                    cut-off row had no way to read the rest. */}
                <span className="min-w-0 flex-1 break-words leading-snug text-paper">
                  {event.participant_name}
                  <span className="text-paper-dim"> {describe(event)}</span>
                  {event.timedOut && (
                    <span className="text-maroon-dim">
                      {' '}
                      · ran out of time{typeof event.timedOut === 'string' ? ` (${event.timedOut})` : ''}
                    </span>
                  )}
                </span>
                {/* Tag above time, stacked, so the text keeps most of the
                    row's width. */}
                <span className="flex shrink-0 flex-col items-end gap-0.5">
                  {tag && (
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase leading-none tracking-wide ring-1 ${TAG_STYLES[tag.key]}`}
                    >
                      {tag.label}
                    </span>
                  )}
                  <span className="text-xs leading-none text-paper-dim/70">
                    {formatClockTime(event.timestamp)}
                  </span>
                </span>
              </li>
            )
          })}
        </ul>
      </ScrollFadeBox>
    </div>
  )
}
