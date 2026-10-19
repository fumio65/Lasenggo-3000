import { Capacitor } from '@capacitor/core'
import { BleClient } from '@capacitor-community/bluetooth-le'

/**
 * app/ble-connect (search + connect only): finds the Lasenggo 3000 device
 * over Bluetooth and connects to it. Sending POUR/TARE/STOP and listening
 * for STATUS (app/ble-commands, app/ble-status-subscription) need the
 * device's GATT service/characteristic UUIDs, which aren't defined until
 * the firmware exists, so they're not here yet.
 *
 * Until the ESP32 is built and advertising, a search always ends in
 * 'not-found'. That's the honest result, and the same code starts finding
 * the device as soon as it exists.
 *
 * Failures are thrown as ConnectError with a `code` the start screen turns
 * into a plain explanation:
 *   unsupported    - no Bluetooth on this phone/browser
 *   bluetooth-off  - Bluetooth is off and the user didn't turn it on
 *   permission     - Bluetooth permission was denied
 *   not-found      - searched, no Lasenggo 3000 nearby
 *   connect-failed - found it but couldn't connect
 *   cancelled      - the user stopped the search
 */

// Advertised name, per ARCHITECTURE.md / CONTEXT.md (no space).
export const DEVICE_NAME = 'Lasenggo3000'
const SCAN_TIMEOUT_MS = 12000

export class ConnectError extends Error {
  constructor(code, cause) {
    super(code)
    this.code = code
    this.cause = cause
  }
}

let stopActiveSearch = null

export async function connectToDevice({ onDisconnect } = {}) {
  const platform = Capacitor.getPlatform()

  try {
    // neverForLocation matches the AndroidManifest declaration, so Android
    // 12+ doesn't ask for location permission just to scan.
    await BleClient.initialize({ androidNeverForLocation: true })
  } catch (err) {
    throw classify(err, 'unsupported')
  }

  if (platform === 'android') {
    let enabled = await BleClient.isEnabled().catch(() => false)
    if (!enabled) {
      // Shows Android's own "Allow Lasenggo to turn on Bluetooth?" prompt.
      await BleClient.requestEnable().catch(() => {})
      enabled = await BleClient.isEnabled().catch(() => false)
    }
    if (!enabled) throw new ConnectError('bluetooth-off')
  }

  let deviceId
  if (platform === 'web') {
    // Browsers can't scan silently; Web Bluetooth always shows its own
    // device picker. Closing it counts as not found.
    try {
      const device = await BleClient.requestDevice({ name: DEVICE_NAME })
      deviceId = device.deviceId
    } catch (err) {
      throw classify(err, 'not-found')
    }
  } else {
    deviceId = await scanForDevice()
  }

  try {
    await BleClient.connect(deviceId, (id) => onDisconnect?.(id))
  } catch (err) {
    throw new ConnectError('connect-failed', err)
  }
  return deviceId
}

/** Stops a search in progress; connectToDevice then rejects with
 * 'cancelled'. Safe to call when nothing is running. */
export function cancelSearch() {
  stopActiveSearch?.()
}

function scanForDevice() {
  return new Promise((resolve, reject) => {
    let done = false
    const finish = (settle) => {
      if (done) return
      done = true
      stopActiveSearch = null
      clearTimeout(timer)
      BleClient.stopLEScan().catch(() => {})
      settle()
    }
    const timer = setTimeout(() => finish(() => reject(new ConnectError('not-found'))), SCAN_TIMEOUT_MS)
    stopActiveSearch = () => finish(() => reject(new ConnectError('cancelled')))
    BleClient.requestLEScan({ name: DEVICE_NAME }, (result) => {
      const id = result?.device?.deviceId
      if (id) finish(() => resolve(id))
    }).catch((err) => finish(() => reject(classify(err, 'not-found'))))
  })
}

function classify(err, fallback) {
  const message = String(err?.message || err || '').toLowerCase()
  if (message.includes('cancel')) return new ConnectError('not-found', err)
  if (message.includes('permission') || message.includes('denied')) return new ConnectError('permission', err)
  if (message.includes('disabled') || message.includes('not enabled') || message.includes('turned off')) {
    return new ConnectError('bluetooth-off', err)
  }
  if (message.includes('not supported') || message.includes('unsupported') || message.includes('not available')) {
    return new ConnectError('unsupported', err)
  }
  return new ConnectError(fallback, err)
}

/** Disconnects from the device (e.g. the user goes back to the start
 * screen to switch modes). Never throws. */
export async function disconnectDevice(deviceId) {
  if (!deviceId) return
  await BleClient.disconnect(deviceId).catch(() => {})
}
