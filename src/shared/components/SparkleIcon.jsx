/**
 * app/history-list (UX pass: name icon, 2nd swap): replaces BookmarkIcon
 * next to a named session's title. A four-point sparkle/star is a common
 * modern-UI idiom for "this one stands out" — reads as a small flourish
 * next to a title rather than a functional marker (tag, bookmark) that
 * implies filing/categorizing, which is closer to what a session's own
 * chosen name actually is: the thing that makes this round memorable
 * enough to name. Same line-stroke convention as the rest of this icon
 * family.
 */
export function SparkleIcon({ className = 'h-4 w-4' }) {
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
      <path d="M12 3.5c.5 3.2 1.3 5 2.8 6.5 1.5 1.5 3.3 2.3 6.5 2.8-3.2.5-5 1.3-6.5 2.8-1.5 1.5-2.3 3.3-2.8 6.5-.5-3.2-1.3-5-2.8-6.5C7.7 14.1 5.9 13.3 2.7 12.8c3.2-.5 5-1.3 6.5-2.8C10.7 8.5 11.5 6.7 12 3.5Z" />
    </svg>
  )
}
