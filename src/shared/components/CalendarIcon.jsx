/**
 * app/history-list (UX pass: date/time icons): small calendar glyph,
 * paired with HistoryIcon's clock face (already this icon family's "time
 * of day" symbol) to label a session's date vs. its time separately.
 * Same stroke convention as the rest of this icon family.
 */
export function CalendarIcon({ className = 'h-4 w-4' }) {
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
      <rect x="3.75" y="5.25" width="16.5" height="15" rx="2" />
      <path d="M8 3.5v3.5" />
      <path d="M16 3.5v3.5" />
      <path d="M3.75 10h16.5" />
    </svg>
  )
}
