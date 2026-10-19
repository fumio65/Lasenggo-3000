import { useState } from 'react'
import { POUR_VOLUMES } from '../../features/pour/usePourVolume'
import { formatVolumeMl } from '../../features/pour/volumeUnits'

export const VOLUME_BY_ID = Object.fromEntries(POUR_VOLUMES.map((v) => [v.id, v]))
// Bar segment colors, in the same light→heavy order as POUR_VOLUMES, plus
// a neutral tone for passes. Deliberately 3 distinct solid colors (pale
// gold → ember → deep red-orange) rather than 3 opacities of the same
// orange — opacity steps on a dark background read as "faded", not as a
// different amount, and were too hard to tell apart at a glance.
export const VOLUME_COLOR = { light: 'bg-pour-light', standard: 'bg-ember', heavy: 'bg-pour-heavy' }
export const PASS_COLOR = 'bg-smoke-light'

/**
 * One participant's pour/pass composition as a stacked bar — how many
 * Light/Standard/Heavy pours vs. passes, plus a ~mL estimate — with the
 * bar's overall width relative to whoever did the most in the group, so it
 * doubles as an at-a-glance "who's drinking fastest" comparison. Shared by
 * ActiveSessionScreen's live SessionLog panel and HistoryDetail's past-
 * session view, so a session reads the same way whether it's happening
 * right now or being looked back on.
 *
 * `isCurrent` (live sessions only — HistoryDetail never passes it, since a
 * past session has no current turn) marks whoever the TurnRing's center
 * label is currently naming: a small pulsing ember dot plus a bolded name,
 * rather than a text label repeating "Current turn" — the row is already
 * moved to the top of the list for this person (see SessionLog), so the
 * marker only needs to carry attention, not re-explain itself. The dot
 * still carries an accessible name/hover tooltip for anyone who needs the
 * word spelled out.
 */
export function ParticipantStatBar({ stat, maxActions, isCurrent = false, isPaused = false, pauseReason }) {
  // app/drink-session-log (UX pass: long drink lists): with several
  // different drinks possible per participant, showing every one inline
  // doesn't scale in this already-compact panel — same problem the
  // queue list had, same fix. Only the most recently poured drink shows
  // by default; the rest collapse behind a "+N more drinks" toggle,
  // local to this row (each participant's own expand/collapse, not
  // shared across the roster).
  const [drinksExpanded, setDrinksExpanded] = useState(false)

  const pourTotal = stat.byVolume.light + stat.byVolume.standard + stat.byVolume.heavy
  const actionTotal = pourTotal + stat.pass
  const widthPct =
    maxActions > 0 ? Math.max((actionTotal / maxActions) * 100, actionTotal > 0 ? 6 : 0) : 0

  // Which volumes this participant actually poured, in the same
  // light→heavy order as the bar segments below and the shared legend.
  const pouredVolumes = POUR_VOLUMES.filter((v) => stat.byVolume[v.id] > 0)

  return (
    <li className={isPaused ? 'opacity-50' : ''}>
      {/* UX fix (app/volume-breakdown-stat): the name and stat line used to
          share one row (`justify-between`, stat side `shrink-0`) — fine
          when the stat text was short ("2 poured · 1 passed"), but a full
          Light/Standard/Heavy breakdown routinely runs longer than that and
          was pushing the name span to zero width in the narrow session-log
          panel (280px), hiding the participant's name entirely and still
          clipping the stat text itself against the panel edge. Stacked
          instead: name (with its own truncate) on its own line, stats
          below as ordinary wrapping text — both can now run to whatever
          length they need without starving each other. UX pass (round 3):
          the name/stat/bar stack was packed edge to edge with only a 4px
          gap before the bar and none between name and stat — tightened a
          little more room between each (`space-y-1.5` wrapper, `mt-2` on
          the bar) so the row doesn't read as cramped. */}
      <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        {isCurrent && (
          <span
            role="img"
            aria-label="Current turn"
            title="Current turn"
            className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-ember"
          />
        )}
        <span className={`min-w-0 truncate text-sm text-paper ${isCurrent ? 'font-semibold' : ''}`}>
          {stat.name}
        </span>
        {isPaused && (
          <span
            title={pauseReason}
            className="shrink-0 rounded-full bg-smoke px-1.5 py-0.5 text-[10px] font-medium text-paper-dim ring-1 ring-smoke-light"
          >
            Paused{pauseReason ? ` · ${pauseReason}` : ''}
          </span>
        )}
      </div>
      {/* app/drink-session-log (fix: switching drinks lumped everyone's
          mL into one combined total, with no way to tell how much came
          from which drink): which drink(s) this person has actually
          poured from this session, each with its *own* running mL/L
          total — not just the drink's name, and not one combined number
          either. A participant who had 150mL of one drink then switched
          to another and had 300mL of it shows both lines separately
          rather than a single "~450mL" that erases which drink any of it
                    came from. Newest-drink-first (see buildStats in SessionLog.jsx
          for why) — omitted entirely for a session with no drink
          tracking or a participant who hasn't poured anything with a
          drink attached yet. */}
      {stat.drinkTotals?.length > 0 && (() => {
        // app/drink-session-log (pour-size per drink), then (UX pass:
        // long drink lists): render one drink's row — the same
        // Light/Standard/Heavy counts the dots above already show for
        // the participant as a whole, but scoped to just this one
        // drink, so "how much" and "how" both read per-drink. Pulled
        // into a closure (not a module-level function) since it's only
        // ever used for this one stat's drinkTotals and needs nothing
        // from outside this render.
        function renderDrinkRow(d) {
          const drinkVolumes = POUR_VOLUMES.filter((v) => d.byVolume[v.id] > 0)
          return (
            <li key={d.name} className="space-y-0.5 text-xs text-paper-dim/80">
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate">{d.name}</span>
                <span className="shrink-0 tabular-nums">~{formatVolumeMl(d.ml)}</span>
              </div>
              {drinkVolumes.length > 0 && (
                <div className="flex items-center gap-2.5 text-paper-dim/60">
                  {drinkVolumes.map((v) => (
                    <span
                      key={v.id}
                      title={`${v.label}: ${d.byVolume[v.id]}`}
                      className="flex items-center gap-1 tabular-nums"
                    >
                      <span aria-hidden="true" className={`h-1.5 w-1.5 shrink-0 rounded-full ${VOLUME_COLOR[v.id]}`} />
                      {d.byVolume[v.id]}
                    </span>
                  ))}
                </div>
              )}
            </li>
          )
        }

        // Fix: this previously read `drinkTotals[length - 1]` as "most
        // recent", which was backwards — `events` (buildStats' source)
        // comes from getSessionEvents ordered newest-first, so a drink's
        // *first* appearance while iterating that list is actually its
        // *most recent* pour, and Object insertion order means
        // `drinkTotals[0]` is the newest drink, not the oldest. The old
        // code was defaulting to whichever drink this person poured
        // first all session, not whichever they're currently on —
        // reported as "it shows the first alcohol, not the current one".
        // `drinkTotals[0]` is the fix; everything after it is already in
        // the right (most-recent-of-the-rest-first) order with no
        // reversal needed.
        const latest = stat.drinkTotals[0]
        const earlier = stat.drinkTotals.slice(1)

        return (
          <ul className="space-y-1">
            {renderDrinkRow(latest)}
            {earlier.length > 0 && (
              <>
                <li>
                  <button
                    type="button"
                    onClick={() => setDrinksExpanded((v) => !v)}
                    className="flex items-center gap-1 text-xs font-medium text-paper-dim/70 transition hover:text-paper-dim"
                  >
                    {drinksExpanded ? 'Hide' : `+${earlier.length} more drink${earlier.length === 1 ? '' : 's'}`}
                    <span
                      className={`inline-block transition-transform ${drinksExpanded ? 'rotate-180' : ''}`}
                    >
                      ▾
                    </span>
                  </button>
                </li>
                {drinksExpanded && earlier.map(renderDrinkRow)}
              </>
            )}
          </ul>
        )
      })()}
      {/* UX pass (round 2, app/volume-breakdown-stat): spelling out "1
          Light · 1 Standard · 1 Heavy poured" read as a dense sentence that
          wrapped awkwardly and duplicated the colored bar directly below
          it in words. Replaced with small colored-dot + count chips using
          the bar's own colors (same ones the shared legend already keys),
          so composition reads at a glance as color instead of as prose —
          the full word is still one hover/tap away via each chip's title,
          same as the bar segments always had. */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-paper-dim">
        {pouredVolumes.length > 0 && (
          <span className="flex items-center gap-2.5">
            {pouredVolumes.map((v) => (
              <span
                key={v.id}
                title={`${v.label}: ${stat.byVolume[v.id]}`}
                className="flex items-center gap-1.5 tabular-nums"
              >
                <span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ${VOLUME_COLOR[v.id]}`} />
                {stat.byVolume[v.id]}
              </span>
            ))}
          </span>
        )}
        <span>
          {pourTotal} poured · {stat.pass} passed
          {stat.totalMl > 0 && (
            <span className="text-paper-dim/70"> · ~{formatVolumeMl(stat.totalMl)}</span>
          )}
        </span>
      </div>
      {/* app/drink-outcome: what was actually drunk, next to what was
          poured. Only shown once at least one of this person's pours has
          an outcome, so sessions from before this feature (no outcomes at
          all) look exactly as they did. Pours still waiting on, or never
          given, an outcome are counted as "not confirmed" rather than
          guessed either way. */}
      {stat.outcome?.confirmed > 0 && (
        <p className="text-xs text-paper-dim">
          Drank ~{formatVolumeMl(stat.outcome.drankMl)}
          <span className="text-paper-dim/70"> of ~{formatVolumeMl(stat.outcome.confirmedPouredMl)}</span>
          {stat.outcome.partial > 0 && <span> · left some {stat.outcome.partial}×</span>}
          {stat.outcome.tapon > 0 && (
            <span className="text-maroon-dim"> · tapon {stat.outcome.tapon}×</span>
          )}
          {stat.outcome.unconfirmed > 0 && (
            <span className="text-paper-dim/70"> · {stat.outcome.unconfirmed} not confirmed</span>
          )}
        </p>
      )}
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-ink">
        <div
          className="flex h-full gap-px transition-[width] duration-500 ease-out"
          style={{ width: `${widthPct}%` }}
        >
          {POUR_VOLUMES.map((v) =>
            stat.byVolume[v.id] > 0 ? (
              <div
                key={v.id}
                className={`h-full ${VOLUME_COLOR[v.id]}`}
                style={{ width: `${(stat.byVolume[v.id] / actionTotal) * 100}%` }}
                title={`${v.label}: ${stat.byVolume[v.id]}`}
              />
            ) : null,
          )}
          {stat.pass > 0 && (
            <div
              className={`h-full ${PASS_COLOR}`}
              style={{ width: `${(stat.pass / actionTotal) * 100}%` }}
              title={`Passed: ${stat.pass}`}
            />
          )}
        </div>
      </div>
      </div>
    </li>
  )
}

/** Shared legend for the Light/Standard/Heavy/Pass colors above — used
 * anywhere a ParticipantStatBar list is shown, so the color key is never
 * duplicated or allowed to drift out of sync with the bar colors. */
export function VolumeLegend() {
  return (
    <div className="flex items-center gap-3 text-[11px] text-paper-dim/70">
      <span className="flex items-center gap-1">
        <span className="h-1.5 w-1.5 rounded-full bg-pour-heavy" /> Heavy
      </span>
      <span className="flex items-center gap-1">
        <span className="h-1.5 w-1.5 rounded-full bg-ember" /> Standard
      </span>
      <span className="flex items-center gap-1">
        <span className="h-1.5 w-1.5 rounded-full bg-pour-light" /> Light
      </span>
      <span className="flex items-center gap-1">
        <span className="h-1.5 w-1.5 rounded-full bg-smoke-light" /> Pass
      </span>
    </div>
  )
}
