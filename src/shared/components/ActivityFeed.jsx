import { VOLUME_BY_ID } from './ParticipantStatBar'
import { ScrollFadeBox } from './ScrollFadeBox'
import { describeOutcome } from '../../features/pour/drinkOutcome'

export function formatClockTime(isoString) {
  return new Date(isoString).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  })
}

/**
 * Chronological pour/pass feed — one colored dot + name + action + clock
 * time per event. Shared between the live session's "Activity log"
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

  return (
    <div className="mt-2">
      <ScrollFadeBox
        maxHeightClassName={maxHeightClassName}
        watch={events.length}
        resetScrollKey={autoScrollToNewest ? events[0]?.id : undefined}
      >
        <ul className="space-y-1.5">
          {events.map((event) => (
            <li
              key={event.id}
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm animate-[log-enter_220ms_ease-out]"
            >
              <span
                aria-hidden="true"
                className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                  event.type === 'POUR'
                    ? 'bg-ember'
                    : event.type === 'PAUSE'
                      ? 'bg-maroon-dim'
                      : 'bg-paper-dim/50'
                }`}
              />
              <span className="min-w-0 flex-1 truncate text-paper">
                {event.participant_name}
                <span className="text-paper-dim">
                  {' '}
                  {event.type === 'POUR' &&
                    // app/drink-session-log (fix: Activity log never
                    // named which drink was poured, only the pour size)
                    // — drink_name comes from getSessionEvents' LEFT
                    // JOIN onto `drinks` and is null for a session that
                    // never used drink tracking, so it's appended only
                    // when present rather than leaving a stray " · " for
                    // every row of an untracked session.
                    `poured${event.volume ? ` (${VOLUME_BY_ID[event.volume]?.label ?? event.volume})` : ''}${event.drink_name ? ` · ${event.drink_name}` : ''}${
                      // app/drink-outcome: what happened to it, once known.
                      describeOutcome(event) ? ` · ${describeOutcome(event)}` : ''
                    }`}
                  {event.type === 'PASS' && 'passed'}
                  {event.type === 'PAUSE' && `paused${event.note ? ` (${event.note})` : ''}`}
                  {event.type === 'RESUME' && 'resumed'}
                </span>
              </span>
              <span className="shrink-0 text-xs text-paper-dim/70">
                {formatClockTime(event.timestamp)}
              </span>
            </li>
          ))}
        </ul>
      </ScrollFadeBox>
    </div>
  )
}
