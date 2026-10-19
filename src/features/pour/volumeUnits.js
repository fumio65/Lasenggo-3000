import { useEffect, useState } from 'react'

/**
 * app/drink-tracking (volume unit follow-up): the drink mL field is a
 * number so remaining-volume math works (can't subtract from "1 jug"),
 * but a bare mL number is awkward to type for a 1L bottle or a case, so
 * this pairs the number with a unit toggle (mL / L) and converts to a
 * plain integer mL before it's ever stored or compared. Nothing downstream
 * (db.js, sessionQueries.js, the "Now serving"/remaining display) ever
 * sees a unit — it's purely an input-time convenience.
 */
export const VOLUME_UNITS = [
  { id: 'ml', label: 'mL', toMl: 1 },
  { id: 'l', label: 'L', toMl: 1000 },
]

/** Converts a raw amount string + unit id into a whole-number mL value,
 * or null if the amount doesn't parse as a positive number (same
 * "blank/invalid -> null, not an error" contract the rest of the optional
 * drink fields already use). */
export function parseVolumeToMl(amountInput, unitId) {
  const amount = parseFloat(amountInput)
  if (!Number.isFinite(amount) || amount <= 0) return null
  const unit = VOLUME_UNITS.find((u) => u.id === unitId) ?? VOLUME_UNITS[0]
  return Math.round(amount * unit.toMl)
}

/** app/drink-session-log (UX follow-up: manual toggle instead of auto
 * switching): every drink-volume display (live session's Drinks log,
 * per-participant breakdowns, History's bars) used to pick mL vs L for
 * itself per-value (>= 1000mL became L), which meant a person skimming a
 * list saw some rows in mL and others in L with no way to pick one and
 * have it stick. `useVolumeDisplayUnit` below is the shared on/off switch
 * for that now — this function just renders a given mL amount in
 * whichever unit the switch currently says, instead of deciding on its
 * own. "L" always converts (e.g. 150mL -> "0.15L") rather than only
 * kicking in above 1000, since the point of switching to L view is
 * consistency across the whole list, not just hiding big numbers.
 * Rounded to 2 decimals with trailing zeros trimmed. Returns null for a
 * null/undefined input so callers can keep their existing
 * `volume_ml != null` guard. `unit` defaults to 'ml' for any caller that
 * hasn't been wired up to the toggle yet. */
export function formatVolumeMl(volumeMl, unit = 'ml') {
  if (volumeMl == null) return null
  if (unit === 'l') {
    const liters = Math.round((volumeMl / 1000) * 100) / 100
    return `${liters}L`
  }
  return `${volumeMl}mL`
}

/** app/drink-session-log (UX follow-up): a tiny shared store — not React
 * context — so the mL/L switch lives in exactly one place (localStorage,
 * key below) and every screen that shows a volume (live SessionLog,
 * ParticipantStatBar, HistoryDetail) reads and flips the *same* switch,
 * without threading a prop through App.jsx and three layers of children
 * for something this small. Flipping it in one place (e.g. History)
 * updates every other mounted screen immediately via the subscriber set,
 * and the choice survives a reload/app restart via localStorage. Falls
 * back to in-memory-only (still works, just doesn't persist) if
 * localStorage throws (private browsing, storage disabled, etc).
 */
const VOLUME_UNIT_STORAGE_KEY = 'lasenggo:volumeDisplayUnit'

function readStoredUnit() {
  try {
    return localStorage.getItem(VOLUME_UNIT_STORAGE_KEY) === 'l' ? 'l' : 'ml'
  } catch {
    return 'ml'
  }
}

let currentVolumeUnit = readStoredUnit()
const volumeUnitListeners = new Set()

export function useVolumeDisplayUnit() {
  const [unit, setUnit] = useState(currentVolumeUnit)

  useEffect(() => {
    volumeUnitListeners.add(setUnit)
    return () => volumeUnitListeners.delete(setUnit)
  }, [])

  function setVolumeDisplayUnit(nextUnit) {
    currentVolumeUnit = nextUnit
    try {
      localStorage.setItem(VOLUME_UNIT_STORAGE_KEY, nextUnit)
    } catch {
      // localStorage unavailable — the toggle still works for this
      // session, it just won't be remembered next time.
    }
    volumeUnitListeners.forEach((listener) => listener(nextUnit))
  }

  return [unit, setVolumeDisplayUnit]
}
