/**
 * app/history-list (UX pass: name icon, 3rd swap): replaces SparkleIcon
 * next to a named session's title. Previous two passes (TagIcon - "price
 * tag", BookmarkIcon - "filed/marked") read as the wrong metaphor; user
 * feedback narrowed it to "a celebration/party vibe" specifically,
 * matching how sessions actually get named in practice ("Jojo's
 * Birthday" was this app's own running example) rather than a generic
 * "this is a title" marker. A party popper — confetti bursting from a
 * cone — is the clearest line-icon shorthand for that. Same stroke
 * convention as the rest of this icon family.
 */
export function PartyIcon({ className = 'h-4 w-4' }) {
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
      <path d="M4.5 19.5 14 10c1-1 1-2.5 0-3.5s-2.5-1-3.5 0L4 13c-.5.5-.5 1.5 0 2l.5 4.5Z" />
      <path d="M16.5 3.5v2" />
      <path d="M20.5 7.5h-2" />
      <path d="M19.5 3.5l-1.4 1.4" />
      <path d="M12.5 13.5l1.5 1.5" />
      <path d="M15.5 10.5l1.5 1.5" />
    </svg>
  )
}
