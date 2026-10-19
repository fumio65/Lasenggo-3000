import { BluetoothIcon } from './BluetoothIcon'
import { GlassIcon } from './GlassIcon'

/**
 * app/session-mode: small badge saying how a session was run, for History.
 * 'hardware' = with the Lasenggo 3000 device (ember, Bluetooth glyph);
 * anything else = logged by hand (neutral, glass glyph). Sessions recorded
 * before modes existed are 'manual' by default (db.js migration).
 */
export function SessionModeBadge({ mode }) {
  const hardware = mode === 'hardware'
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ${
        hardware
          ? 'bg-ember/15 text-ember ring-ember/40'
          : 'bg-smoke-light/60 text-paper-dim ring-smoke-light'
      }`}
    >
      {hardware ? <BluetoothIcon className="h-3 w-3" /> : <GlassIcon className="h-3 w-3" />}
      {hardware ? 'Lasenggo 3000' : 'Manual'}
    </span>
  )
}
