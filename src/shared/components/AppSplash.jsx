import { useEffect } from 'react'

/**
 * app/animated-splash: full-screen splash shown while App.jsx waits on
 * initDatabase() — a gap that previously had no loading UI at all.
 *
 * A one-shot reveal, not a loop: the ring of six dots pops into place, a
 * shot glass appears at the center, a stream pours in and fills it, then
 * the stream's tail drops in and the wordmark arrives (~2.55s). After that
 * everything holds still until App.jsx fades it out. An earlier version
 * pulsed the dots forever while waiting, which read as a loading spinner
 * rather than a splash. All timing lives in index.css (.splash-* classes).
 *
 * App.jsx owns show/hide timing: it flips `fading` once the database is
 * ready AND the reveal has finished, waits for the 300ms fade below, then
 * unmounts this component.
 *
 * The native Android splash (drawable/splash.png, same ink background)
 * is what's visible before React mounts. SplashScreen.hide() fires the
 * moment this mounts; with the same background color on both layers the
 * handoff has no visible seam.
 */
const DOTS = [
  { dx: 0, dy: -80, delay: 0.05 },
  { dx: 69.3, dy: -40, delay: 0.13 },
  { dx: 69.3, dy: 40, delay: 0.21 },
  { dx: 0, dy: 80, delay: 0.29 },
  { dx: -69.3, dy: 40, delay: 0.37 },
  { dx: -69.3, dy: -40, delay: 0.45 },
]

export function AppSplash({ fading }) {
  useEffect(() => {
    // Only does anything on a native build. Wrapped so a plain browser
    // preview with no Capacitor runtime can't crash on a missing bridge.
    import('@capacitor/splash-screen')
      .then(({ SplashScreen }) => SplashScreen.hide())
      .catch(() => {})
  }, [])

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-ink transition-opacity duration-300 ${
        fading ? 'pointer-events-none opacity-0' : 'opacity-100'
      }`}
      aria-hidden="true"
    >
      <div className="splash-ring">
        {DOTS.map((dot, i) => (
          <div
            key={i}
            className="splash-dot"
            style={{ '--dx': `${dot.dx}px`, '--dy': `${dot.dy}px`, animationDelay: `${dot.delay}s` }}
          />
        ))}
        <svg className="splash-glass" viewBox="0 0 80 100">
          <defs>
            <clipPath id="splash-glass-inside">
              <path d="M16 32 H64 L58.4 90 H21.6 Z" />
            </clipPath>
          </defs>
          <line className="splash-stream" x1="40" y1="-18" x2="40" y2="88" pathLength="100" />
          <g className="splash-glass-body">
            <rect
              className="splash-liquid"
              x="0"
              y="54"
              width="80"
              height="38"
              clipPath="url(#splash-glass-inside)"
            />
            <path
              d="M14 30 H66 L60 92 H20 Z"
              fill="none"
              stroke="currentColor"
              strokeWidth="4"
              strokeLinejoin="round"
              className="text-ember"
            />
            <line x1="19.4" y1="84" x2="60.6" y2="84" stroke="currentColor" strokeWidth="2.4" className="text-ember" />
          </g>
        </svg>
      </div>
      <div className="splash-wordmark absolute bottom-[14%] font-display text-sm tracking-[0.08em] text-paper-dim">
        LASENGGO
      </div>
    </div>
  )
}
