import { useEffect, useRef, useState } from 'react'
import { GlassIcon } from '../../shared/components/GlassIcon'
import { cancelSearch, connectToDevice } from '../ble/connectDevice'

// Six dots around the ring, starting at the top and going clockwise, in
// the same 108-unit space as the app icon.
const DOTS = [0, 60, 120, 180, 240, 300].map((deg) => {
  const a = (deg * Math.PI) / 180
  return { x: 54 + 26 * Math.sin(a), y: 54 - 26 * Math.cos(a), delay: (deg / 60) * 0.18 }
})

// What the circle says in each state. Failure codes come from
// connectDevice.js's ConnectError.
const MESSAGES = {
  idle: { title: 'Tap to connect', body: 'Turn on your Lasenggo 3000 and keep it nearby.' },
  searching: { title: 'Looking for Lasenggo 3000…', body: 'Keep the device on and close to your phone.' },
  connected: { title: 'Connected', body: 'Lasenggo 3000 is ready.' },
  'not-found': {
    title: "Couldn't find Lasenggo 3000",
    body: 'Make sure it’s switched on and nearby, then tap the circle to try again.',
  },
  'bluetooth-off': { title: 'Bluetooth is off', body: 'Turn on Bluetooth, then tap the circle to try again.' },
  permission: {
    title: 'Bluetooth permission needed',
    body: 'Allow Nearby devices for Lasenggo in your phone’s settings, then try again.',
  },
  unsupported: {
    title: 'Bluetooth isn’t available here',
    body: 'This phone or browser can’t use Bluetooth. You can still use the app without the device.',
  },
  'connect-failed': {
    title: 'Couldn’t connect',
    body: 'Found the device, but connecting failed. Tap the circle to try again.',
  },
}

/**
 * app/session-mode + app/ble-connect: shown every time the app opens,
 * after the splash. The big circle is the app's own mark (six dots around
 * a shot glass): tapping it turns on Bluetooth and searches for the
 * device, the dots light up in sequence while it searches, and on success
 * they all light and the glass fills before continuing. Tapping it again
 * while searching cancels. "Use without the device" stays one tap away
 * underneath for manual rounds.
 *
 * Until the ESP32 exists, a search ends in "Couldn't find Lasenggo 3000".
 */
export function StartScreen({ onChooseManual, onConnected, onDeviceDisconnected }) {
  const [status, setStatus] = useState('idle')
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      cancelSearch()
    }
  }, [])

  async function handleCircle() {
    if (status === 'connected') return
    if (status === 'searching') {
      cancelSearch()
      return
    }
    setStatus('searching')
    try {
      const deviceId = await connectToDevice({ onDisconnect: onDeviceDisconnected })
      if (!mounted.current) return
      setStatus('connected')
      // Let the "all lit + glass fills" moment land before moving on.
      setTimeout(() => mounted.current && onConnected(deviceId), 1100)
    } catch (err) {
      if (!mounted.current) return
      setStatus(err?.code === 'cancelled' ? 'idle' : err?.code in MESSAGES ? err.code : 'not-found')
    }
  }

  const visual = ['idle', 'searching', 'connected'].includes(status) ? status : 'failed'
  const message = MESSAGES[status] ?? MESSAGES['not-found']
  const isFailure = visual === 'failed'

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-ink px-6 py-10 text-paper">
      <div className="flex w-full max-w-md flex-col items-center gap-8">
        <header className="space-y-2 text-center">
          <h1 className="font-display text-3xl font-semibold tracking-tight">Lasenggo</h1>
          <p className="text-sm text-paper-dim">How are you pouring tonight?</p>
        </header>

        <div className="flex flex-col items-center gap-4" data-state={visual}>
          <button
            type="button"
            onClick={handleCircle}
            disabled={status === 'connected'}
            aria-label={
              status === 'searching' ? 'Stop searching for Lasenggo 3000' : 'Connect to Lasenggo 3000 over Bluetooth'
            }
            className="relative h-56 w-56 rounded-full bg-smoke/60 ring-1 ring-smoke-light transition active:scale-95 disabled:active:scale-100"
          >
            <svg viewBox="22 22 64 64" className="h-full w-full p-6 text-ember" aria-hidden="true">
              <circle className="connect-ring" cx="54" cy="54" r="26" fill="none" stroke="currentColor" strokeWidth="0.9" />
              {DOTS.map((d, i) => (
                <circle
                  key={i}
                  className="connect-dot"
                  cx={d.x}
                  cy={d.y}
                  r="4.5"
                  fill="currentColor"
                  style={{ animationDelay: `${d.delay}s` }}
                />
              ))}
              <g transform="translate(54 54) scale(0.42) translate(-40 -61)">
                <clipPath id="connect-glass-inside">
                  <path d="M16 32 H64 L58.4 90 H21.6 Z" />
                </clipPath>
                <rect
                  className="connect-liquid"
                  x="0"
                  y="54"
                  width="80"
                  height="38"
                  fill="currentColor"
                  opacity="0.9"
                  clipPath="url(#connect-glass-inside)"
                />
                <path d="M14 30 H66 L60 92 H20 Z" fill="none" stroke="currentColor" strokeWidth="5.5" strokeLinejoin="round" />
                <line x1="19.4" y1="84" x2="60.6" y2="84" stroke="currentColor" strokeWidth="3.2" />
              </g>
            </svg>
          </button>

          {/* Fixed minimum height so the circle and title don't shift as the
              message changes length between states. */}
          <div className="min-h-[7.5rem] space-y-1 text-center" aria-live="polite">
            <p className={`font-display text-lg font-semibold ${isFailure ? 'text-maroon-dim' : 'text-paper'}`}>
              {message.title}
            </p>
            <p className="mx-auto max-w-xs text-sm text-paper-dim">{message.body}</p>
            {status === 'searching' && (
              <button
                type="button"
                onClick={cancelSearch}
                className="mt-1 rounded-full px-3 py-1 text-xs font-semibold text-paper-dim transition hover:text-paper"
              >
                Cancel
              </button>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            cancelSearch()
            onChooseManual()
          }}
          disabled={status === 'connected'}
          className="flex w-full items-center gap-3 rounded-2xl bg-smoke px-4 py-3 text-left ring-1 ring-smoke-light transition hover:bg-smoke-light active:scale-[0.98] disabled:opacity-40"
        >
          <span className="rounded-xl bg-smoke-light p-2 text-paper-dim">
            <GlassIcon className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-paper">Use without the device</span>
            <span className="block text-xs text-paper-dim">Log pours by hand. Everything else works the same.</span>
          </span>
        </button>
      </div>
    </div>
  )
}
