/**
 * Crisp SVG chevron for the app's "Back"/"Return" buttons (ActiveSessionScreen,
 * HistoryList, HistoryDetail) — replaces the plain "←" text glyph, which
 * renders with inconsistent weight/shape depending on the device's font and
 * never quite matched the rest of the icon-free, deliberately-drawn UI.
 * `currentColor` so it inherits the button's text color (including the
 * hover/active states already defined on each button).
 */
export function BackIcon({ className = 'h-4 w-4' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.25}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M15 5L8 12L15 19" />
    </svg>
  )
}
