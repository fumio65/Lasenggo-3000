import { useEffect } from 'react'

/**
 * app/animated-splash: full-screen splash shown while App.jsx waits on
 * initDatabase() (and, non-blockingly, ensureAnonymousSession()) — a gap
 * that previously had no loading UI at all, just the Participants screen
 * rendering immediately with small status pills in the corner.
 *
 * Six dots light up in sequence around a ring — the turn order coming
 * alive — looping for as long as `fading` is false. App.jsx owns the
 * actual show/hide timing: it flips `fading` to true once the app is
 * ready AND the animation has had time to read as intentional (not just
 * a flash), waits for the fade-out transition below to finish, then
 * unmounts this component entirely.
 *
 * The native Android splash (drawable/splash.png, same ink background +
 * same ember glass-and-ring artwork) is still what's visible for the
 * instant before React mounts. SplashScreen.hide() fires the moment this
 * component mounts, handing off to this animation — since both share the
 * exact ink background color, there's no visible seam between the native
 * layer and this one, just a static image starting to move.
 */
export function AppSplash({ fading }) {
  useEffect(() => {
    // Dynamic import + swallowed rejection: this plugin only does
    // anything on a native (Android) build. Capacitor's own web
    // implementation already no-ops safely, but this is wrapped
    // defensively anyway so a plain browser preview — no Capacitor
    // runtime present at all — can't crash the app over a missing
    // native bridge.
    import('@capacitor/splash-screen')
      .then(({ SplashScreen }) => SplashScreen.hide())
      .catch(() => {})
  }, [])

  const dots = [
    { dx: 0, dy: -70, delay: 0 },
    { dx: 60.6, dy: -35, delay: 0.18 },
    { dx: 60.6, dy: 35, delay: 0.36 },
    { dx: 0, dy: 70, delay: 0.54 },
    { dx: -60.6, dy: 35, delay: 0.72 },
    { dx: -60.6, dy: -35, delay: 0.9 },
  ]

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-ink transition-opacity duration-300 ${
        fading ? 'pointer-events-none opacity-0' : 'opacity-100'
      }`}
      aria-hidden="true"
    >
      <div className="relative h-44 w-44">
        {dots.map((dot, i) => (
          <div
            key={i}
            className="absolute left-1/2 top-1/2 h-[34px] w-[34px] rounded-full bg-ember opacity-[0.18] [animation:splash-dot_2.6s_ease-in-out_infinite]"
            style={{ '--dx': `${dot.dx}px`, '--dy': `${dot.dy}px`, animationDelay: `${dot.delay}s` }}
          />
        ))}
      </div>
      <div className="absolute bottom-[14%] font-display text-sm tracking-[0.08em] text-paper-dim opacity-80">
        LASENGGO
      </div>
    </div>
  )
}
