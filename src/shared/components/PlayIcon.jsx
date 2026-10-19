/**
 * app/history-resume: small play-triangle glyph for the "Resume session"
 * action on a past session's overview. Same stroke convention as the
 * rest of this icon family, filled (not outlined) since a play symbol
 * reads clearest as a solid triangle.
 */
export function PlayIcon({ className = 'h-4 w-4' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      stroke="none"
      className={className}
      aria-hidden="true"
    >
      <path d="M7.5 5.2c0-.9 1-1.5 1.8-1l10 6.8c.7.5.7 1.5 0 2l-10 6.8c-.8.5-1.8-.1-1.8-1V5.2Z" />
    </svg>
  )
}
