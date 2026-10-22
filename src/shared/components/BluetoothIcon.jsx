/** app/session-mode: Bluetooth glyph for the start screen's "Connect to
 * Lasenggo 3000" option. Same stroke convention as the other icons. */
export function BluetoothIcon({ className = 'h-5 w-5' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M7 7l10 10-5 5V2l5 5L7 17" />
    </svg>
  )
}
