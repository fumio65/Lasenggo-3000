import { BluetoothIcon } from '../../shared/components/BluetoothIcon'
import { GlassIcon } from '../../shared/components/GlassIcon'

// The app icon's mark (ring of six dots around a filled shot glass), drawn
// small for the top of this screen so it continues straight on from the
// splash's final frame.
function AppMark() {
  const dots = [0, 60, 120, 180, 240, 300].map((deg) => {
    const a = (deg * Math.PI) / 180
    return [54 + 26 * Math.sin(a), 54 - 26 * Math.cos(a)]
  })
  return (
    <svg viewBox="22 22 64 64" className="mx-auto h-16 w-16 text-ember" aria-hidden="true">
      <circle cx="54" cy="54" r="26" fill="none" stroke="currentColor" strokeWidth="0.9" opacity="0.3" />
      {dots.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="4.5" fill="currentColor" />
      ))}
      <g transform="translate(54 54) scale(0.42) translate(-40 -61)">
        <clipPath id="start-mark-inside">
          <path d="M16 32 H64 L58.4 90 H21.6 Z" />
        </clipPath>
        <rect x="0" y="54" width="80" height="38" fill="currentColor" opacity="0.9" clipPath="url(#start-mark-inside)" />
        <path d="M14 30 H66 L60 92 H20 Z" fill="none" stroke="currentColor" strokeWidth="5.5" strokeLinejoin="round" />
        <line x1="19.4" y1="84" x2="60.6" y2="84" stroke="currentColor" strokeWidth="3.2" />
      </g>
    </svg>
  )
}

/**
 * app/session-mode: shown every time the app opens, after the splash (the
 * user chose "every time" over remembering the last choice, so it's always
 * clear which mode a round runs in). Two ways to run a round:
 *
 * - Connect to Lasenggo 3000: Pour drives the device over Bluetooth.
 *   Shown but disabled and marked "Coming soon" until app/ble-connect
 *   exists; there's no Bluetooth code or hardware yet, and faking a
 *   connection would label sessions as device sessions that never were.
 * - Use without the device: manual mode. Everything works (turns, pours,
 *   drink tracking, history); Pour just logs a drink poured by hand.
 *
 * The choice is stored on each session (`sessions.mode`) and shown as a
 * badge in History.
 */
export function StartScreen({ onChooseManual }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-ink px-6 py-10 text-paper">
      <div className="w-full max-w-md space-y-8">
        <header className="space-y-3 text-center">
          <AppMark />
          <h1 className="font-display text-3xl font-semibold tracking-tight">Lasenggo</h1>
          <p className="text-sm text-paper-dim">How are you pouring tonight?</p>
        </header>

        <div className="space-y-3">
          <div
            aria-disabled="true"
            className="flex items-start gap-3 rounded-2xl bg-smoke/60 p-4 ring-1 ring-smoke-light opacity-70"
          >
            <span className="mt-0.5 rounded-xl bg-smoke-light p-2 text-paper-dim">
              <BluetoothIcon />
            </span>
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-display text-base font-semibold text-paper">Connect to Lasenggo 3000</h2>
                <span className="rounded-full bg-smoke-light px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-paper-dim">
                  Coming soon
                </span>
              </div>
              <p className="text-sm text-paper-dim">
                Pour with the device over Bluetooth. Not available yet: the hardware is still being
                built.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onChooseManual}
            className="flex w-full items-start gap-3 rounded-2xl bg-smoke p-4 text-left ring-1 ring-ember/60 transition hover:bg-smoke-light active:scale-[0.98]"
          >
            <span className="mt-0.5 rounded-xl bg-ember/15 p-2 text-ember">
              <GlassIcon className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1 space-y-1">
              <span className="block font-display text-base font-semibold text-paper">
                Use without the device
              </span>
              <span className="block text-sm text-paper-dim">
                Log pours and passes by hand. Turns, drinks and history all work the same.
              </span>
            </span>
          </button>
        </div>
      </div>
    </div>
  )
}
