/**
 * app/drink-queue-list: trash-can glyph for "Delete" actions on a queued-
 * drink row, replacing the plain text button. Same stroke convention as
 * the rest of this icon family — `currentColor` so it inherits the
 * button's text color (including the maroon "armed" state).
 */
export function TrashIcon({ className = 'h-4 w-4' }) {
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
      <path d="M4 7h16" />
      <path d="M9 7V4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5V7" />
      <path d="M6 7l1 13.25A1.75 1.75 0 0 0 8.75 22h6.5A1.75 1.75 0 0 0 17 20.25L18 7" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  )
}
