import { POUR_VOLUMES } from './usePourVolume'

/**
 * Light/Standard/Heavy segmented control. Purely a selector — it has no
 * effect on hardware yet since the Pour button isn't wired to BLE
 * (`app/ble-commands`). The selected volume will be read from here once
 * that task sends the POUR command with a calibrated duration.
 */
export function PourVolumeSelector({ volumeId, onChange }) {
  return (
    <div className="flex w-full gap-2">
      {POUR_VOLUMES.map((v) => {
        const active = v.id === volumeId
        return (
          <button
            key={v.id}
            type="button"
            onClick={() => onChange(v.id)}
            aria-pressed={active}
            className={`flex-1 rounded-xl px-3 py-2 text-sm font-medium transition active:scale-95 ${
              active
                ? 'bg-ember text-ink'
                : 'bg-smoke text-paper-dim hover:text-paper'
            }`}
          >
            {v.label}
            <span className="block text-xs opacity-70">~{v.approxMl}mL</span>
          </button>
        )
      })}
    </div>
  )
}
