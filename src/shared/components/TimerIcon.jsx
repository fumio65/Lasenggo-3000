/**
 * app/turn-timer: a simple stopwatch glyph for the turn-timer control.
 * Same stroke convention as the rest of this icon family (BackIcon,
 * HistoryIcon, EditIcon, TrashIcon, SwitchIcon) — `currentColor` so it
 * inherits the button's text color.
 */
export function TimerIcon({ className = 'h-4 w-4' }) {
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
      <circle cx="12" cy="13" r="8" />
      <path d="M12 9v4l2.5 2.5" />
      <path d="M9 2h6" />
      <path d="M19 5l-1.5 1.5" />
    </svg>
  )
}
