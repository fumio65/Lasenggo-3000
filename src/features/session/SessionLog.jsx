import { useMemo } from 'react'
import { ParticipantStatBar, VolumeLegend, VOLUME_BY_ID } from '../../shared/components/ParticipantStatBar'
import { ScrollFadeBox } from '../../shared/components/ScrollFadeBox'
import { ActivityFeed } from '../../shared/components/ActivityFeed'
import { formatVolumeMl } from '../pour/volumeUnits'

/** Builds the per-participant breakdown ParticipantStatBar renders: a pour
 * count per volume id, a pass count, and a total-mL estimate (count ×
 * usePourVolume.js's approxMl per volume) — participants are included even
 * with zero events, in session/turn order, so the panel reads as a roster,
 * not just "whoever has done something so far". */
function buildStats(participants, events) {
  const base = Object.fromEntries(
    participants.map((p) => [
      p.id,
      {
        id: p.id,
        name: p.name,
        pass: 0,
        totalMl: 0,
        byVolume: { light: 0, standard: 0, heavy: 0 },
        // app/drink-session-log (fix: switching drinks lumped everyone's
        // mL into one combined total, with no way to tell how much came
        // from the drink before a switch vs. the one after): a running
        // mL total *per drink name* rather than one combined number, in
        // first-poured order (a plain object preserves insertion order
        // for string keys, same guarantee a Map would give here). Each
        // pour's approxMl is added to its own drink's bucket, not to a
        // single pot every pour shares.
        drinkTotalsByName: {},
      },
    ]),
  )

  for (const event of events) {
    const row = base[event.participant_id]
    if (!row) continue // defensive: a participant removed mid-session, say
    if (event.type === 'PASS') {
      row.pass += 1
    } else if (event.type === 'POUR' && row.byVolume[event.volume] !== undefined) {
      row.byVolume[event.volume] += 1
      const ml = VOLUME_BY_ID[event.volume]?.approxMl ?? 0
      row.totalMl += ml
      if (event.drink_name) {
        row.drinkTotalsByName[event.drink_name] = (row.drinkTotalsByName[event.drink_name] ?? 0) + ml
      }
    }
  }

  return participants.map((p) => {
    const { drinkTotalsByName, ...rest } = base[p.id]
    return {
      ...rest,
      drinkTotals: Object.entries(drinkTotalsByName).map(([name, ml]) => ({ name, ml })),
    }
  })
}

/**
 * Session log side panel: a per-participant breakdown (how many Light/
 * Standard/Heavy pours, how many passes, ~mL total) with a stacked bar per
 * person (shared `ParticipantStatBar` — HistoryDetail uses the exact same
 * visualization for a *past* session, so the two read consistently)
 * followed by a short recent-activity feed for "what just happened". Sits
 * beside the turn ring on wider viewports, stacks below it on a phone.
 *
 * Both the stat-bar list and the activity feed are capped to a fixed
 * height with `ScrollFadeBox` rather than growing unbounded — this panel
 * is `md:sticky`, so a session with a lot of participants would otherwise
 * turn an always-visible sidebar into one that keeps growing past the
 * viewport, burying "Activity log" further down with every person
 * added. A short roster just never shows a fade/scroll at all.
 */
export function SessionLog({ events, participants, currentParticipantId, pausedIds, pauseReasons, drinks = [] }) {
  const stats = useMemo(() => {
    // UX fix: this used to pull the current participant to the front while
    // leaving everyone else at their original absolute position (so turn
    // C would show [C, A, B, D] instead of the actual upcoming sequence).
    // Rotating the *participant list itself* around whoever's current —
    // before building stats from it — gives the real turn order starting
    // from now: [C, D, A, B] for the same example, matching what the
    // TurnRing would actually do next, next, next.
    const currentIdx = participants.findIndex((p) => p.id === currentParticipantId)
    const rotated =
      currentIdx > 0
        ? [...participants.slice(currentIdx), ...participants.slice(0, currentIdx)]
        : participants
    return buildStats(rotated, events)
  }, [participants, events, currentParticipantId])
  const maxActions = Math.max(
    1,
    ...stats.map((s) => s.byVolume.light + s.byVolume.standard + s.byVolume.heavy + s.pass),
  )
  const recent = events.slice(0, 12)

  return (
    <aside className="w-full rounded-2xl bg-smoke/60 p-4 ring-1 ring-smoke-light md:sticky md:top-10">
      <h2 className="font-display text-sm font-semibold text-paper">Session log</h2>

      {participants.length === 0 ? (
        <p className="mt-3 text-sm text-paper-dim">No participants in this round yet.</p>
      ) : (
        <>
          <div className="mt-3">
            <ScrollFadeBox maxHeightClassName="max-h-64" watch={stats.length}>
              <ul className="space-y-4">
                {stats.map((stat) => (
                  <ParticipantStatBar
                    key={stat.id}
                    stat={stat}
                    maxActions={maxActions}
                    isCurrent={stat.id === currentParticipantId}
                    isPaused={pausedIds?.has(stat.id)}
                    pauseReason={pauseReasons?.[stat.id]}
                  />
                ))}
              </ul>
            </ScrollFadeBox>
          </div>

          <div className="mt-3">
            <VolumeLegend />
          </div>

          {/* app/drink-session-log: every drink this session has touched —
              "Now serving", everything queued behind it, and anything
              already switched away from — not just the picker-friendly
              subset getSessionDrinkHistory exposes elsewhere. Hidden
              entirely for a session that never used drink tracking, same
              as HistoryDetail's past-session equivalent. */}
          {drinks.length > 0 && (
            <>
              <h3 className="mt-5 font-display text-xs font-semibold text-paper-dim">
                Drinks
              </h3>
              <ul className="mt-2 space-y-1.5">
                {drinks.map((drink) => (
                  <li key={drink.id} className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="truncate text-paper">
                      {drink.name}
                      {drink.volume_ml != null && (
                        <span className="text-paper-dim"> · {formatVolumeMl(drink.volume_ml)}</span>
                      )}
                    </span>
                    <span className="shrink-0 text-xs text-paper-dim">
                      {drink.status === 'serving'
                        ? 'Now serving'
                        : drink.status === 'queued'
                          ? 'Queued'
                          : 'Served'}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}

          <h3 className="mt-5 font-display text-xs font-semibold text-paper-dim">
            Activity log
          </h3>
          <ActivityFeed events={recent} maxHeightClassName="max-h-56" autoScrollToNewest />
        </>
      )}
    </aside>
  )
}
