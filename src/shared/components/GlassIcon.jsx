/**
 * app/saved-drinks: small shot-glass glyph for the "Drinks" button next to
 * People. Same shape as the app icon's glass (rounded taper, base line),
 * same stroke convention as PeopleIcon/HistoryIcon.
 */
export function GlassIcon({ className = 'h-4 w-4' }) {
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
      <path d="M6 4h12l-1.6 16H7.6L6 4Z" />
      <path d="M7.2 16h9.6" />
    </svg>
  )
}
