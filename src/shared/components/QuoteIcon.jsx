/**
 * app/history-list (UX pass: name icon, 4th swap): replaces PartyIcon
 * next to a named session's title. PartyIcon assumed every named session
 * is a celebration ("Jojo's Birthday") — user feedback: "sometimes the
 * session is not a party it's just a chill drinking session". A session
 * name can be anything, so the icon needs to be mood-neutral: a small
 * quote mark, signaling "this is a title someone gave it" without
 * implying what kind of occasion it was. Same stroke convention as the
 * rest of this icon family.
 */
export function QuoteIcon({ className = 'h-4 w-4' }) {
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
      <path d="M9.5 6.5c-2.5 1-4 3.3-4 6.1 0 1.9 1.3 3.4 3 3.4s3-1.3 3-3c0-1.6-1.1-2.9-2.6-3.1.3-1.3 1.2-2.3 2.6-2.9l-2-.5Z" />
      <path d="M18 6.5c-2.5 1-4 3.3-4 6.1 0 1.9 1.3 3.4 3 3.4s3-1.3 3-3c0-1.6-1.1-2.9-2.6-3.1.3-1.3 1.2-2.3 2.6-2.9l-2-.5Z" />
    </svg>
  )
}
