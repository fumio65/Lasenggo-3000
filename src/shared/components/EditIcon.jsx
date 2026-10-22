/**
 * app/drink-queue-list: pencil glyph for "Edit" actions on a queued-drink
 * row. Same stroke convention as BackIcon/HistoryIcon so the icon family
 * stays consistent — `currentColor` so it inherits the button's text color.
 */
export function EditIcon({ className = 'h-4 w-4' }) {
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
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
      <path d="M14.5 5.5l3 3" />
    </svg>
  )
}
