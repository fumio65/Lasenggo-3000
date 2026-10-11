import { useLayoutEffect, useRef, useState } from 'react'
import { HistoryIcon } from '../../shared/components/HistoryIcon'

function ParticipantRow({
  participant,
  index,
  total,
  onRemove,
  onMoveUp,
  onMoveDown,
  rowRef,
  onDragPointerDown,
  onDragPointerMove,
  onDragPointerUp,
  isDragging,
  dragTransform,
}) {
  return (
    <li
      ref={rowRef}
      style={
        isDragging
          ? { transform: dragTransform, transition: 'none' }
          : undefined
      }
      className={`flex items-center gap-2 rounded-xl bg-smoke px-3 py-3 transition-colors ${
        isDragging
          ? 'relative z-20 shadow-lg shadow-ink/60 ring-2 ring-ember'
          : 'hover:bg-smoke-light'
      }`}
    >
      <button
        type="button"
        onPointerDown={(e) => onDragPointerDown(e, participant.id)}
        onPointerMove={onDragPointerMove}
        onPointerUp={onDragPointerUp}
        onPointerCancel={onDragPointerUp}
        aria-label={`Drag to reorder ${participant.name}`}
        className={`touch-none select-none rounded-lg px-1.5 py-1 text-paper-dim/60 transition hover:text-paper active:cursor-grabbing ${
          isDragging ? 'cursor-grabbing text-ember' : 'cursor-grab'
        }`}
      >
        ⠿
      </button>
      <span className="w-5 font-display text-sm text-paper-dim">{index + 1}</span>
      <span className="flex-1 truncate text-paper">{participant.name}</span>
      <div className="flex items-center gap-0.5">
        <button
          type="button"
          onClick={onMoveUp}
          disabled={index === 0}
          aria-label={`Move ${participant.name} up`}
          className="rounded-lg px-2.5 py-1.5 text-paper-dim transition hover:bg-smoke-light hover:text-paper active:scale-90 disabled:opacity-30 disabled:hover:bg-transparent"
        >
          ↑
        </button>
        <button
          type="button"
          onClick={onMoveDown}
          disabled={index === total - 1}
          aria-label={`Move ${participant.name} down`}
          className="rounded-lg px-2.5 py-1.5 text-paper-dim transition hover:bg-smoke-light hover:text-paper active:scale-90 disabled:opacity-30 disabled:hover:bg-transparent"
        >
          ↓
        </button>
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${participant.name}`}
          className="ml-1 rounded-lg px-2.5 py-1.5 text-maroon-dim transition hover:bg-maroon/20 active:scale-90"
        >
          ✕
        </button>
      </div>
    </li>
  )
}

/**
 * Presentational participant list screen. Participant state lives in `App`
 * (lifted up) so `onStartSession` can hand the finished list to the active
 * session screen.
 *
 * Night Market redesign (UX pass): grouped into labeled sections — "Who's
 * joining" and "Session settings" are visually distinct cards instead of one
 * flat stack of unlabeled, placeholder-only inputs — and "Start session" is
 * the only ember-filled button on the screen, so it reads as the one thing
 * this screen wants you to do. "Add" is a plain outlined button since it's
 * a repeatable, low-stakes action, not the destination.
 *
 * Reordering: the grip handle supports pointer-based drag-to-reorder (mouse,
 * touch and pen all fire the same Pointer Events, which matters since this
 * ships as a touch-first Android app). The ↑/↓ buttons stay as the
 * keyboard/screen-reader-reachable fallback — dragging alone isn't
 * accessible that way. Every reorder, whether from a drag or an arrow tap,
 * animates with a FLIP transition (rows that aren't being dragged slide
 * smoothly into their new slot instead of snapping), so "who's first" always
 * reads as a motion, not just a list that silently changed.
 */
export function ParticipantList({
  participants,
  onAdd,
  onRemove,
  onMoveUp,
  onMoveDown,
  onReorder,
  onStartSession,
  startingSession = false,
  onViewHistory,
}) {
  const [name, setName] = useState('')
  const [sessionName, setSessionName] = useState('')
  const [passLimitInput, setPassLimitInput] = useState('')

  // --- Drag-to-reorder + FLIP animation ---------------------------------
  const rowRefs = useRef(new Map())
  const prevRectsRef = useRef(new Map())
  const [drag, setDrag] = useState(null) // { id, startY, currentY }

  function setRowRef(id, node) {
    if (node) rowRefs.current.set(id, node)
    else rowRefs.current.delete(id)
  }

  // FLIP: runs after every reorder (drag-driven or arrow-driven). Measures
  // each row's new position, compares it to where it was before this
  // render, and — for every row except the one actively being dragged
  // (that one already follows the pointer directly) — snaps it back to its
  // old spot with no transition, then releases it on the next frame so it
  // glides into the new spot instead of jumping there.
  useLayoutEffect(() => {
    const newTops = new Map()
    rowRefs.current.forEach((node, id) => {
      if (node) newTops.set(id, node.getBoundingClientRect().top)
    })

    const prevTops = prevRectsRef.current
    const toRelease = []
    rowRefs.current.forEach((node, id) => {
      if (!node || id === drag?.id) return
      const prevTop = prevTops.get(id)
      const newTop = newTops.get(id)
      if (prevTop == null || newTop == null || prevTop === newTop) return
      const delta = prevTop - newTop
      node.style.transition = 'none'
      node.style.transform = `translateY(${delta}px)`
      toRelease.push(node)
    })

    if (toRelease.length > 0) {
      requestAnimationFrame(() => {
        toRelease.forEach((node) => {
          node.style.transition = 'transform 220ms ease-out'
          node.style.transform = ''
        })
      })
    }

    prevRectsRef.current = newTops
  }, [participants, drag?.id])

  function handleDragPointerDown(e, id) {
    e.currentTarget.setPointerCapture?.(e.pointerId)
    setDrag({ id, startY: e.clientY, currentY: e.clientY })
  }

  function handleDragPointerMove(e) {
    if (!drag) return
    const currentY = e.clientY
    setDrag((d) => (d ? { ...d, currentY } : d))

    const draggedIndex = participants.findIndex((p) => p.id === drag.id)
    if (draggedIndex === -1) return
    let targetIndex = draggedIndex

    rowRefs.current.forEach((node, id) => {
      if (id === drag.id || !node) return
      const idx = participants.findIndex((p) => p.id === id)
      if (idx === -1) return
      const rect = node.getBoundingClientRect()
      const midpoint = rect.top + rect.height / 2
      if (idx > draggedIndex && currentY > midpoint) {
        targetIndex = Math.max(targetIndex, idx)
      } else if (idx < draggedIndex && currentY < midpoint) {
        targetIndex = Math.min(targetIndex, idx)
      }
    })

    if (targetIndex !== draggedIndex) {
      onReorder(draggedIndex, targetIndex)
    }
  }

  function handleDragPointerUp() {
    setDrag(null)
  }
  // -----------------------------------------------------------------------

  function handleSubmit(e) {
    e.preventDefault()
    onAdd(name)
    setName('')
  }

  function handleStart() {
    // app/pass-limit-house-rule: blank/invalid/non-positive stays disabled
    // (null), matching useTurnManager's `passLimit` contract.
    const parsedLimit = parseInt(passLimitInput, 10)
    const passLimit = Number.isInteger(parsedLimit) && parsedLimit > 0 ? parsedLimit : null
    onStartSession(sessionName, passLimit)
  }

  return (
    <div className="min-h-screen bg-ink px-6 py-10 text-paper">
      <div className="mx-auto max-w-md space-y-8">
        <header className="space-y-1 text-center">
          <h1 className="font-display text-3xl font-semibold tracking-tight text-paper">
            Lasenggo 3000
          </h1>
          <p className="text-sm text-paper-dim">
            Add everyone joining this round before you start.
          </p>
          <button
            type="button"
            onClick={onViewHistory}
            className="mx-auto mt-3 flex items-center gap-1.5 rounded-lg bg-smoke px-3 py-1.5 text-sm text-paper-dim ring-1 ring-smoke-light transition hover:bg-smoke-light hover:text-paper active:scale-95"
          >
            <HistoryIcon />
            Session history
          </button>
        </header>

        <section className="space-y-3 rounded-2xl bg-smoke/60 p-4 ring-1 ring-smoke-light">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-sm font-semibold text-paper">Who's joining</h2>
            <span className="text-xs text-paper-dim">
              {participants.length} added
            </span>
          </div>

          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Participant name"
              aria-label="Participant name"
              className="flex-1 rounded-xl bg-ink px-4 py-2 text-paper placeholder-paper-dim/60 outline-none ring-1 ring-smoke-light focus:ring-2 focus:ring-ember"
            />
            <button
              type="submit"
              disabled={!name.trim()}
              className="rounded-xl px-4 py-2 font-medium text-paper ring-1 ring-smoke-light transition hover:bg-smoke-light active:scale-95 disabled:opacity-30"
            >
              Add
            </button>
          </form>

          {participants.length === 0 ? (
            <p className="rounded-xl border border-dashed border-smoke-light px-4 py-8 text-center text-sm text-paper-dim">
              No one added yet. Add at least two people to start a session.
            </p>
          ) : (
            <>
              <p className="px-1 text-xs text-paper-dim/70">
                Drag ⠿ to reorder, or use the arrows.
              </p>
              <ul className="space-y-2">
                {participants.map((participant, index) => (
                  <ParticipantRow
                    key={participant.id}
                    participant={participant}
                    index={index}
                    total={participants.length}
                    onRemove={() => onRemove(participant.id)}
                    onMoveUp={() => onMoveUp(participant.id)}
                    onMoveDown={() => onMoveDown(participant.id)}
                    rowRef={(node) => setRowRef(participant.id, node)}
                    onDragPointerDown={handleDragPointerDown}
                    onDragPointerMove={handleDragPointerMove}
                    onDragPointerUp={handleDragPointerUp}
                    isDragging={drag?.id === participant.id}
                    dragTransform={
                      drag?.id === participant.id
                        ? `translateY(${drag.currentY - drag.startY}px) scale(1.02)`
                        : undefined
                    }
                  />
                ))}
              </ul>
            </>
          )}
        </section>

        <section className="space-y-3 rounded-2xl bg-smoke/60 p-4 ring-1 ring-smoke-light">
          <h2 className="font-display text-sm font-semibold text-paper">
            Session settings <span className="font-normal text-paper-dim">(optional)</span>
          </h2>

          <div className="space-y-1">
            <label htmlFor="session-name" className="text-xs text-paper-dim">
              Session name
            </label>
            {/* app/session-naming: optional — a blank name falls back to showing
                the date in history (see sessionQueries.js / HistoryList.jsx). */}
            <input
              id="session-name"
              type="text"
              value={sessionName}
              onChange={(e) => setSessionName(e.target.value)}
              placeholder="e.g. Jojo's Birthday"
              className="w-full rounded-xl bg-ink px-4 py-2 text-paper placeholder-paper-dim/60 outline-none ring-1 ring-smoke-light focus:ring-2 focus:ring-ember"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="pass-limit" className="text-xs text-paper-dim">
              Pass limit
            </label>
            {/* app/pass-limit-house-rule: optional — a blank/0 value disables it.
                Soft rule only for now (see useTurnManager) — shows a warning once
                someone's hit it, doesn't block Pass. */}
            <input
              id="pass-limit"
              type="number"
              min="1"
              inputMode="numeric"
              value={passLimitInput}
              onChange={(e) => setPassLimitInput(e.target.value)}
              placeholder="No limit"
              className="w-full rounded-xl bg-ink px-4 py-2 text-paper placeholder-paper-dim/60 outline-none ring-1 ring-smoke-light [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none focus:ring-2 focus:ring-ember"
            />
          </div>
        </section>

        <button
          type="button"
          onClick={handleStart}
          disabled={participants.length < 2 || startingSession}
          className="w-full rounded-xl bg-ember px-4 py-3 font-display text-lg font-semibold text-ink transition active:scale-[0.98] disabled:opacity-30"
        >
          {startingSession ? 'Starting…' : 'Start session'}
        </button>
      </div>
    </div>
  )
}
