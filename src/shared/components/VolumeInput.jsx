import { VOLUME_UNITS } from '../../features/pour/volumeUnits'

/**
 * app/drink-tracking (volume unit follow-up): a number input paired with
 * an mL/L segmented toggle, used anywhere a drink volume is entered
 * ("Who's joining" and the mid-session "different drink" form). Fully
 * controlled — the parent owns `amount`/`unit` and converts to mL (via
 * `parseVolumeToMl`) only at submit time, same pattern the rest of this
 * app's optional-field inputs already follow.
 */
export function VolumeInput({
  amount,
  unit,
  onAmountChange,
  onUnitChange,
  idPrefix,
  label = 'Volume',
  className = '',
}) {
  return (
    <div className={`flex gap-1 ${className}`}>
      <input
        id={idPrefix ? `${idPrefix}-amount` : undefined}
        type="number"
        min="0"
        step="any"
        inputMode="decimal"
        value={amount}
        onChange={(e) => onAmountChange(e.target.value)}
        placeholder={unit === 'l' ? 'e.g. 1' : 'e.g. 750'}
        aria-label={label}
        className="w-20 rounded-xl bg-ink px-3 py-2 text-paper placeholder-paper-dim/60 outline-none ring-1 ring-smoke-light [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none focus:ring-2 focus:ring-ember"
      />
      <div
        role="group"
        aria-label={`${label} unit`}
        className="flex overflow-hidden rounded-xl ring-1 ring-smoke-light"
      >
        {VOLUME_UNITS.map((u) => (
          <button
            key={u.id}
            type="button"
            onClick={() => onUnitChange(u.id)}
            aria-pressed={unit === u.id}
            className={`px-2.5 text-xs font-medium transition ${
              unit === u.id
                ? 'bg-ember text-ink'
                : 'bg-ink text-paper-dim hover:text-paper'
            }`}
          >
            {u.label}
          </button>
        ))}
      </div>
    </div>
  )
}
