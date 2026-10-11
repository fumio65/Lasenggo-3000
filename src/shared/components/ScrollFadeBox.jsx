import { useEffect, useLayoutEffect, useRef, useState } from 'react'

/**
 * Generic scrollable box with a hidden scrollbar and a soft edge fade on
 * whichever side still has hidden content — "it scrolls, but stays boxed
 * and doesn't show a visible scrollbar". Shared so this pattern can't drift
 * between SessionLog's Recent Activity feed and its participant stat-bar
 * list (the latter needed this specifically because an unbounded stat list
 * would turn an always-visible sticky sidebar into an unbounded one once a
 * session has a lot of participants).
 *
 * `watch` should be something that changes when the content's size might
 * have changed (e.g. an item count) — triggers a fade re-check beyond just
 * the user's own scroll. `resetScrollKey`, if given, scrolls back to the
 * top (smoothly) whenever it changes — e.g. the newest item's id, so a
 * fresh entry never lands silently off-screen above someone scrolled down.
 */
export function ScrollFadeBox({ children, maxHeightClassName = 'max-h-56', watch, resetScrollKey }) {
  const ref = useRef(null)
  const [canScrollUp, setCanScrollUp] = useState(false)
  const [canScrollDown, setCanScrollDown] = useState(false)

  function updateScrollState() {
    const el = ref.current
    if (!el) return
    setCanScrollUp(el.scrollTop > 2)
    setCanScrollDown(el.scrollTop + el.clientHeight < el.scrollHeight - 2)
  }

  useLayoutEffect(() => {
    updateScrollState()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watch])

  useEffect(() => {
    if (resetScrollKey === undefined) return
    ref.current?.scrollTo({ top: 0, behavior: 'smooth' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetScrollKey])

  return (
    <div className="relative">
      <div
        ref={ref}
        onScroll={updateScrollState}
        className={`no-scrollbar overflow-y-auto pr-1 ${maxHeightClassName}`}
      >
        {children}
      </div>
      {canScrollUp && (
        <div className="pointer-events-none absolute inset-x-0 top-0 h-5 bg-gradient-to-b from-smoke/80 to-transparent" />
      )}
      {canScrollDown && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-5 bg-gradient-to-t from-smoke/80 to-transparent" />
      )}
    </div>
  )
}
