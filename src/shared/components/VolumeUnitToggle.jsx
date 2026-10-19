import { VOLUME_UNITS, useVolumeDisplayUnit } from '../../features/pour/volumeUnits'

/**
 * app/drink-session-log (UX follow-up): the mL/L pill switch itself —
 * two small buttons sharing one pill, same visual language as the pour-
 * size/preset pickers elsewhere in the app. Reads and flips the shared
 * `useVolumeDisplayUnit` store, so wherever this is mounted (SessionLog,
 * HistoryDetail) it's changing the one switch every volume display reads
 * from, not a local-only preference. A session only needs one of these
 * visible at a time to control every volume on screen, so callers mount
 * it once per screen, near whichever "Drinks" section it governs.
 */
export function VolumeUnitToggle() {
  const [unit, setUnit] = useVolumeDisplayUnit()

  return (
    <div
      role="group"
      aria-label="Volume unit"
      className="inline-flex shrink-0 overflow-hidden rounded-full bg-ink ring-1 ring-smoke-light"
    >
      {VOLUME_UNITS.map((u) => (
        <button
          key={u.id}
          type="button"
          onClick={() => setUnit(u.id)}
          aria-pressed={unit === u.id}
          className={`px-2.5 py-1 text-xs font-semibold transition-colors ${
            unit === u.id ? 'bg-ember text-ink' : 'text-paper-dim hover:text-paper'
          }`}
        >
          {u.label}
        </button>
      ))}
    </div>
  )
}
