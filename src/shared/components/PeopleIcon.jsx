/**
 * Small two-person glyph for the roster "People" button (ParticipantList).
 * Same stroke convention as BackIcon/HistoryIcon so the three read as one
 * icon family.
 */
export function PeopleIcon({ className = 'h-4 w-4' }) {
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
      <circle cx="8.5" cy="8" r="2.75" />
      <path d="M3.5 18c0-2.9 2.24-5 5-5s5 2.1 5 5" />
      <path d="M15 8.25a2.5 2.5 0 1 1 1.5 4.5" />
      <path d="M15.5 13.25c2.3.3 4 2.2 4 4.75" />
    </svg>
  )
}
