import { useEffect, useRef, useState } from 'react'

const PAUSE_REASONS = ['Drunk', 'Went home', 'Ran away', 'Emergency', 'Other']

/**
 * "Manage participants" overlay for an active session (app/pause-participant,
 * app/edit-participant-name) — the two real-world cases this covers both
 * reduce to the same toggle: someone who's had too much, or who's stepped
 * out for an emergency and might come back, should drop out of the turn
 * rotation without their name disappearing or their pours/passes so far
 * being lost. There's no separate "remove" — Pause *is* the remove, and
 * Resume is how they rejoin if they come back.
 *
 * app/pause-reason-tag: Pause asks for a reason *before* it takes effect,
 * tapping a chip (Drunk / Went home / Takas / Emergency / Other) — not an
 * afterthought you could skip. The real case this protects is the person
 * who never taps Resume (went home, snuck off/"takas") — if the reason
 * weren't captured at the moment of pausing, it'd never get captured at
 * all. Resuming never needs a reason; it's just "they're back".
 */
export function ParticipantManagerSheet({
  participants,
  pausedIds,
  pauseReasons,
  onRename,
  onPause,
  onResume,
  onAdd,
  onClose,
}) {
  const [editingId, setEditingId] = useState(null)
  const [editValue, setEditValue] = useState('')
  const [newName, setNewName] = useState('')
  const [pausingId, setPausingId] = useState(null)

  // UX fix: with a long roster, adding someone appends them off the
  // bottom of this scrollable list — they were there, just out of view,
  // with no indication anything happened. Scroll to the new last row
  // whenever the list grows (not on every render — e.g. not when a pause
  // toggle changes nothing about the list's length).
  const listRef = useRef(null)
  const prevCountRef = useRef(participants.length)
  useEffect(() => {
    if (participants.length > prevCountRef.current) {
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
    }
    prevCountRef.current = participants.length
  }, [participants.length])

  function startEdit(p) {
    setEditingId(p.id)
    setEditValue(p.name)
  }

  function saveEdit() {
    if (editingId) onRename(editingId, editValue)
    setEditingId(null)
  }

  function submitAdd(e) {
    e.preventDefault()
    const trimmed = newName.trim()
    if (!trimmed) return
    onAdd(trimmed)
    setNewName('')
  }

  return (
    <div className="fixed inset-0 z-20 flex items-end justify-center bg-ink/70 p-4 backdrop-blur-sm sm:items-center">
      <div className="w-full max-w-md space-y-4 rounded-2xl bg-smoke p-5 ring-1 ring-smoke-light">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-base font-semibold text-paper">Manage participants</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-2 py-1 text-sm text-paper-dim transition hover:text-paper active:scale-95"
          >
            Done
          </button>
        </div>

        <ul ref={listRef} className="max-h-[60vh] space-y-2 overflow-y-auto no-scrollbar">
          {participants.map((p) => {
            const isPaused = pausedIds.has(p.id)
            const isEditing = editingId === p.id
            return (
              <li
                key={p.id}
                className={`flex items-center gap-2 rounded-xl bg-ink px-3 py-2 ring-1 ring-smoke-light ${
                  isPaused ? 'opacity-60' : ''
                }`}
              >
                {isEditing ? (
                  <input
                    autoFocus
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveEdit()
                      if (e.key === 'Escape') setEditingId(null)
                    }}
                    onBlur={saveEdit}
                    className="min-w-0 flex-1 rounded-lg bg-smoke px-2 py-1 text-sm text-paper outline-none ring-1 ring-ember"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => startEdit(p)}
                    className="min-w-0 flex-1 truncate text-left text-sm text-paper transition hover:text-ember"
                    title="Edit name"
                  >
                    {p.name}
                  </button>
                )}

                {isPaused && !isEditing && (
                  <span
                    title={pauseReasons?.[p.id]}
                    className="shrink-0 rounded-full bg-smoke px-1.5 py-0.5 text-[10px] font-medium text-paper-dim ring-1 ring-smoke-light"
                  >
                    Paused{pauseReasons?.[p.id] ? ` · ${pauseReasons[p.id]}` : ''}
                  </span>
                )}

                {!isEditing && (
                  <button
                    type="button"
                    onClick={() => (isPaused ? onResume(p.id) : setPausingId(p.id))}
                    className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium transition active:scale-95 ${
                      isPaused
                        ? 'bg-ember text-ink'
                        : 'bg-smoke text-paper-dim ring-1 ring-smoke-light hover:text-paper'
                    }`}
                  >
                    {isPaused ? 'Resume' : 'Pause'}
                  </button>
                )}
              </li>
            )
          })}
        </ul>

        {pausingId && (
          <div className="space-y-2 rounded-xl bg-ink px-3 py-3 ring-1 ring-smoke-light">
            <p className="text-xs text-paper-dim">
              Why is {participants.find((p) => p.id === pausingId)?.name} stepping out?
            </p>
            <div className="flex flex-wrap gap-1.5">
              {PAUSE_REASONS.map((reason) => (
                <button
                  key={reason}
                  type="button"
                  onClick={() => {
                    onPause(pausingId, reason)
                    setPausingId(null)
                  }}
                  className="rounded-full bg-smoke px-2.5 py-1 text-xs text-paper-dim ring-1 ring-smoke-light transition hover:bg-smoke-light hover:text-paper active:scale-95"
                >
                  {reason}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setPausingId(null)}
                className="rounded-full px-2.5 py-1 text-xs text-paper-dim transition hover:text-paper active:scale-95"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <form onSubmit={submitAdd} className="flex items-center gap-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Add someone who just joined"
            className="min-w-0 flex-1 rounded-lg bg-ink px-3 py-2 text-sm text-paper placeholder:text-paper-dim/60 outline-none ring-1 ring-smoke-light focus:ring-ember"
          />
          <button
            type="submit"
            disabled={!newName.trim()}
            className="shrink-0 rounded-lg bg-ember px-3 py-2 text-sm font-semibold text-ink transition active:scale-95 disabled:opacity-40"
          >
            Add
          </button>
        </form>

        <p className="text-xs text-paper-dim">
          Paused participants are skipped in the turn order but stay in tonight's log. Resume
          anytime.
        </p>
      </div>
    </div>
  )
}
