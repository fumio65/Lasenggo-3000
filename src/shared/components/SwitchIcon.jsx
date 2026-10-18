/**
 * app/drink-queue-list: two-arrow "swap" glyph for the "Switch now" action
 * on a queued-drink row, paired with its label. Same stroke convention as
 * the rest of this icon family.
 */
export function SwitchIcon({ className = 'h-4 w-4' }) {
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
      <path d="M17 3l4 4-4 4" />
      <path d="M21 7H9a4 4 0 0 0-4 4v1" />
      <path d="M7 21l-4-4 4-4" />
      <path d="M3 17h12a4 4 0 0 0 4-4v-1" />
    </svg>
  )
}
