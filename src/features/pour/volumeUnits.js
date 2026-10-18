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
