/**
 * The visual signature of the active session screen: participants arranged
 * as a ring, the current turn glowing at the position it's reached — the
 * ring *is* the turn order, not decoration around it. Advancing the turn
 * (Pass/Pour) animates the glow handing off to the next dot rather than
 * jumping, echoing the physical ritual of passing a drink around a circle.
 */
export function TurnRing({ participants, currentIndex, current, pausedIds }) {
  const size = 224 // px, matches h-56/w-56 below
  const radius = size / 2 - 14
  const center = size / 2

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <div className="absolute inset-0 rounded-full border border-smoke-light" />

      {participants.map((p, i) => {
        const angle = (360 / participants.length) * i - 90
        const x = center + Math.cos((angle * Math.PI) / 180) * radius
        const y = center + Math.sin((angle * Math.PI) / 180) * radius
        const isCurrent = i === currentIndex
        const isPaused = pausedIds?.has(p.id)

        return (
          <span
            key={p.id}
            aria-hidden="true"
            style={{ left: x, top: y }}
            className="absolute -translate-x-1/2 -translate-y-1/2"
          >
            <span
              className={`block rounded-full transition-all duration-500 ease-out ${
                isCurrent
                  ? 'h-4 w-4 bg-ember shadow-[0_0_18px_5px_rgba(233,138,46,0.55)]'
                  : isPaused
                    ? 'h-2 w-2 bg-smoke-light opacity-35'
                    : 'h-2 w-2 bg-smoke-light'
              }`}
            />
          </span>
        )
      })}

      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 px-6 text-center">
        <p className="text-xs text-paper-dim">Current turn</p>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-paper">
          {current?.name ?? '—'}
        </h1>
      </div>
    </div>
  )
}
