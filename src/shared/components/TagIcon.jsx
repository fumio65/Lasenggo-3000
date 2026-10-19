/**
 * app/history-list (UX pass: icon-led rows): small price-tag/label glyph
 * for a session's custom name — pairs with CalendarIcon/HistoryIcon's
 * clock face and PeopleIcon so every piece of info in a History row has
 * its own icon instead of just the date/time + participant count.
 */
export function TagIcon({ className = 'h-4 w-4' }) {
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
      <path d="M11.25 3.75H6a2.25 2.25 0 0 0-2.25 2.25v5.25a2.25 2.25 0 0 0 .66 1.59l8.69 8.69a2.25 2.25 0 0 0 3.18 0l5.25-5.25a2.25 2.25 0 0 0 0-3.18l-8.69-8.69a2.25 2.25 0 0 0-1.59-.66Z" />
      <circle cx="8.25" cy="8.25" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  )
}
