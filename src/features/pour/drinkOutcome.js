import { POUR_VOLUMES } from './usePourVolume'

/**
 * app/drink-outcome: what happened to a poured drink after the pour.
 *
 * A POUR event only proves the drink went into the cup. These outcomes
 * record whether it was then drunk. They're entered by hand today (the
 * Finished / Tapon buttons after each pour); once the load
 * cell exists, the cup coming back to the platform at its pre-pour weight
 * can fill in the same values automatically. Neither way can tell a drink
 * that was swallowed from one that was dumped out of sight, so "finished"
 * means "the cup came back empty", nothing stronger.
 */
export const OUTCOMES = {
  finished: { id: 'finished', label: 'Finished' },
  partial: { id: 'partial', label: 'Left some' },
  tapon: { id: 'tapon', label: 'Tapon' },
}

// 'partial' has no button: the cup's LED stays lit while any drink is left,
// so people finish the cup instead of logging leftovers by hand. The value
// is kept for the load cell, which can measure what's left exactly when a
// cup comes back heavier than it left. These buckets only phrase such a
// measured amount in the activity feed ("left about half").
const LEFT_AMOUNTS = [
  { id: 'little', label: 'A little', fraction: 0.25 },
  { id: 'half', label: 'About half', fraction: 0.5 },
  { id: 'most', label: 'Most of it', fraction: 0.75 },
]

export function approxMlForVolume(volumeId) {
  return POUR_VOLUMES.find((v) => v.id === volumeId)?.approxMl ?? 0
}

/** mL left in the cup for a given outcome, from the pour's own size. */
export function leftMlFor(outcome, pouredMl, fraction = 0) {
  if (outcome === 'finished') return 0
  if (outcome === 'tapon') return pouredMl
  return Math.round(pouredMl * fraction)
}

/** Short past-tense phrase for one pour's outcome, for the activity feed.
 * Tapon isn't phrased here: the feed shows it as its own tag instead of
 * appending it to an already long line that gets cut off.
 * Partial pours name the closest LEFT_AMOUNTS bucket rather than a raw mL
 * figure, since the mL is itself an estimate. */
export function describeOutcome(event) {
  if (event.outcome === 'finished') return 'finished'
  if (event.outcome === 'partial') {
    const poured = approxMlForVolume(event.volume)
    const fraction = poured > 0 ? (event.left_ml ?? 0) / poured : 0
    const closest = LEFT_AMOUNTS.reduce((best, a) =>
      Math.abs(a.fraction - fraction) < Math.abs(best.fraction - fraction) ? a : best,
    )
    return `left ${closest.label.toLowerCase()}`
  }
  return null
}

/**
 * Per-participant totals from a session's events: how much was actually
 * drunk vs. poured, and how many pours ended each way. `confirmed` counts
 * pours with any outcome; `unconfirmed` counts pours without one, so the
 * UI can say "2 not confirmed" instead of silently treating them as drunk
 * or not drunk. Sessions from before this feature have only unconfirmed
 * pours, and callers hide the whole line in that case.
 */
export function summarizeOutcomes(events) {
  const byParticipant = {}
  for (const event of events) {
    if (event.type !== 'POUR') continue
    const row =
      byParticipant[event.participant_id] ??
      (byParticipant[event.participant_id] = {
        drankMl: 0,
        confirmedPouredMl: 0,
        confirmed: 0,
        unconfirmed: 0,
        partial: 0,
        tapon: 0,
        // Tapon count per pour size, so the stat bar can carve tapon pours
        // out of their Light/Standard/Heavy segment into a Tapon segment.
        taponByVolume: { light: 0, standard: 0, heavy: 0 },
      })
    if (!event.outcome) {
      row.unconfirmed += 1
      continue
    }
    const poured = approxMlForVolume(event.volume)
    const left = Math.min(event.left_ml ?? 0, poured)
    row.confirmed += 1
    row.confirmedPouredMl += poured
    row.drankMl += poured - left
    if (event.outcome === 'partial') row.partial += 1
    if (event.outcome === 'tapon') {
      row.tapon += 1
      if (row.taponByVolume[event.volume] !== undefined) row.taponByVolume[event.volume] += 1
    }
  }
  return byParticipant
}
