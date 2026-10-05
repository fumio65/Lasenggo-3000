import { useState } from 'react'

/**
 * Pour volume setting: Light / Standard / Heavy, per PRD.md and
 * DECISIONS.md ("Pour volume: configurable, not fixed"). Standard is the
 * default. This only tracks the selected UI value — turning it into an
 * actual pump duration and sending it over BLE is `app/ble-commands`.
 */
export const POUR_VOLUMES = [
  { id: 'light', label: 'Light', approxMl: 15 },
  { id: 'standard', label: 'Standard', approxMl: 30 },
  { id: 'heavy', label: 'Heavy', approxMl: 50 },
]

export function usePourVolume(initial = 'standard') {
  const [volumeId, setVolumeId] = useState(initial)
  const volume = POUR_VOLUMES.find((v) => v.id === volumeId) ?? POUR_VOLUMES[1]

  return { volume, volumeId, setVolumeId }
}
