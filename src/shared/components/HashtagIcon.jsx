/**
 * app/history-list (UX pass: name icon, 5th swap): replaces QuoteIcon
 * next to a named session's title. User wanted "a tag" again but
 * explicitly not the first attempt's price-tag/ticket shape (read as
 * commerce-coded) — a hashtag (#) is the other common meaning of "tag"
 * in modern UI (social-media labels), without the price-tag baggage.
 * Same stroke convention as the rest of this icon family.
 */
export function HashtagIcon({ className = 'h-4 w-4' }) {
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
      <path d="M9.5 3.5 7 20.5" />
      <path d="M17 3.5 14.5 20.5" />
      <path d="M4.5 9h15.5" />
      <path d="M3.5 15h15.5" />
    </svg>
  )
}
