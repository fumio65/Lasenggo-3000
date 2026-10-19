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

/** app/drink-session-log: the display-time inverse of parseVolumeToMl —
 * a stored mL integer is always plain mL, but showing "1500mL" for a 1.5L
 * bottle everywhere a drink's volume appears (the live session's Drinks
 * log, per-participant breakdowns) reads worse than showing it in the
 * unit a person would actually say out loud. Switches to L at >= 1000mL,
 * rounded to 2 decimals with trailing zeros trimmed (1500 -> "1.5L", 2000
 * -> "2L"), otherwise plain "<n>mL". Returns null for a null/undefined
 * input so callers can keep their existing `volume_ml != null` guard.
 *
 * app/drink-session-log (UX follow-up, reverted): a manual mL/L toggle
 * was tried here and in the live session + History headers, then
 * explicitly pulled back out of both places on user feedback — this is
 * back to the original auto-switching behavior, no `unit` param. */
export function formatVolumeMl(volumeMl) {
  if (volumeMl == null) return null
  if (volumeMl >= 1000) {
    const liters = Math.round((volumeMl / 1000) * 100) / 100
    return `${liters}L`
  }
  return `${volumeMl}mL`
}

/** app/saved-drinks: turns a stored mL value back into the amount + unit a
 * VolumeInput should show, for tap-to-fill from a saved drink. Uses L from
 * 1000mL up (1000 -> "1" L, 1500 -> "1.5" L), same threshold as
 * formatVolumeMl, so a picked "1L" bottle fills in as 1 L rather than
 * 1000 mL. Null fills in blank. */
export function volumeMlToInput(volumeMl) {
  if (volumeMl == null) return { amount: '', unit: 'ml' }
  if (volumeMl >= 1000) {
    return { amount: String(Math.round((volumeMl / 1000) * 1000) / 1000), unit: 'l' }
  }
  return { amount: String(volumeMl), unit: 'ml' }
}
