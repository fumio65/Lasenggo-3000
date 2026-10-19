/**
 * app/history-list (UX pass: name icon follow-up): replaces TagIcon next
 * to a named session's title — a price-tag glyph read as commerce-coded
 * ("doesn't feel right" per user feedback) for what's really just "this
 * session has a title". A bookmark/ribbon shape is the more familiar
 * "this one's been named/marked" symbol and fits this icon family's
 * plain line-stroke convention the same way.
 */
export function BookmarkIcon({ className = 'h-4 w-4' }) {
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
      <path d="M6.75 3.75h10.5a1 1 0 0 1 1 1v15.5l-6.25-4-6.25 4V4.75a1 1 0 0 1 1-1Z" />
    </svg>
  )
}
