import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { HistoryIcon } from '../../shared/components/HistoryIcon'
import { PeopleIcon } from '../../shared/components/PeopleIcon'
import { getPeople } from '../storage/peopleQueries'
import { VolumeInput } from '../../shared/components/VolumeInput'
import { parseVolumeToMl } from '../pour/volumeUnits'

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
  isEditing,
  editFirst,
  editLast,
  onStartEdit,
  onChangeEditFirst,
  onChangeEditLast,
  onSaveEdit,
  onCancelEdit,
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
      {/* app/edit-participant-pre-session: tapping a name here edits it
          right on "Who's joining" - the same name copy that goes into
          onAdd/onRename below, before Start session has even been
          clicked, so a typo doesn't have to wait until mid-session to
          fix (ParticipantManagerSheet's own edit only exists once a
          session's running). */}
      {isEditing ? (
        <div
          className="flex min-w-0 flex-1 gap-1.5"
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget)) onSaveEdit()
          }}
        >
          <input
            autoFocus
            value={editFirst}
            onChange={(e) => onChangeEditFirst(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onSaveEdit()
              if (e.key === 'Escape') onCancelEdit()
            }}
            placeholder="First name"
            aria-label="First name"
            className="min-w-0 flex-1 rounded-lg bg-ink px-2 py-1 text-sm text-paper outline-none ring-1 ring-ember"
          />
          <input
            value={editLast}
            onChange={(e) => onChangeEditLast(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onSaveEdit()
              if (e.key === 'Escape') onCancelEdit()
            }}
            placeholder="Last name"
            aria-label="Last name"
            className="min-w-0 flex-1 rounded-lg bg-ink px-2 py-1 text-sm text-paper outline-none ring-1 ring-ember"
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={onStartEdit}
          className="min-w-0 flex-1 truncate text-left text-paper transition hover:text-ember"
          title="Edit name"
        >
          {participant.name}
        </button>
      )}
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
  onRename,
  onRemove,
  onMoveUp,
  onMoveDown,
  onReorder,
  onStartSession,
  startingSession = false,
  onViewHistory,
  onViewPeople,
  dbReady = true,
}) {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [duplicateError, setDuplicateError] = useState(null)

  // app/edit-participant-pre-session: editing state for a row already on
  // "Who's joining" - separate from the add form's firstName/lastName
  // above, since both can't be mid-edit for the same reason at once.
  const [editingId, setEditingId] = useState(null)
  const [editFirst, setEditFirst] = useState('')
  const [editLast, setEditLast] = useState('')

  function startEditParticipant(participant) {
    setEditingId(participant.id)
    setEditFirst(participant.firstName || participant.name)
    setEditLast(participant.lastName || '')
  }

  function saveEditParticipant() {
    const id = editingId
    const trimmedFirst = editFirst.trim()
    setEditingId(null)
    if (!id || !trimmedFirst) return
    const trimmedLast = editLast.trim()
    const fullName = trimmedLast ? `${trimmedFirst} ${trimmedLast}` : trimmedFirst
    onRename?.(id, fullName, trimmedFirst, trimmedLast || null)
  }
  const [sessionName, setSessionName] = useState('')
  const [passLimitInput, setPassLimitInput] = useState('')
  // app/drink-tracking: optional, same as session name/pass limit above —
  // only turns into a logged drinks row (sessionQueries.createSession) if
  // a name was actually given.
  const [drinkName, setDrinkName] = useState('')
  const [drinkVolumeInput, setDrinkVolumeInput] = useState('')
  const [drinkVolumeUnit, setDrinkVolumeUnit] = useState('ml')

  // app/people-roster: the name field's autocomplete options, sourced from
  // the recurring "people" roster (most-recently-used first - see
  // peopleQueries.getPeople) rather than this session's own participant
  // list. Loaded on mount, and re-loaded whenever this screen re-mounts
  // (e.g. coming back from the roster screen), so a rename/delete made
  // there is reflected without needing a full page reload.
  const [peopleOptions, setPeopleOptions] = useState([])

  // Waits on `dbReady` (App.jsx's dbStatus === 'ready') rather than firing
  // unconditionally on mount: this screen renders immediately on page load,
  // before `initDatabase()` necessarily resolves, so querying right away
  // raced the DB connection and could silently leave the suggestion list
  // empty for the rest of the session (no retry) if it lost that race.
  useEffect(() => {
    if (!dbReady) return
    getPeople()
      .then(setPeopleOptions)
      .catch((err) => console.error('Failed to load people roster', err))
  }, [dbReady])

  // app/people-roster (design pass): custom-styled suggestion list replacing
  // the native <datalist>. The native one worked, but its dropdown arrow and
  // the browser-chrome suggestion popup it opens don't match this app's own
  // dark theme at all and can't be restyled — this gives the same
  // "suggest whoever I've tagayed with before" behavior with the app's own
  // colors/rounding, while keeping the full peopleOptions list (not just a
  // filtered one) for the aria-expanded check below.
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [highlightIndex, setHighlightIndex] = useState(-1)

  const filteredPeople = (() => {
    const query = firstName.trim().toLowerCase()
    const matches = query
      ? peopleOptions.filter((person) => person.name.toLowerCase().includes(query))
      : peopleOptions
    return matches.slice(0, 6)
  })()

  // app/participant-first-last-name: picking a suggestion fills both
  // fields from the roster's own split (falling back to the whole `name`
  // as first name for any roster entry that somehow still lacks
  // first_name, though the db.js migration backfills every existing row).
  function pickSuggestion(person) {
    setFirstName(person.first_name || person.name)
    setLastName(person.last_name || '')
    setShowSuggestions(false)
    setHighlightIndex(-1)
  }

  function handleNameKeyDown(e) {
    if (!showSuggestions || filteredPeople.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightIndex((i) => (i + 1) % filteredPeople.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightIndex((i) => (i <= 0 ? filteredPeople.length - 1 : i - 1))
    } else if (e.key === 'Enter' && highlightIndex >= 0) {
      e.preventDefault()
      pickSuggestion(filteredPeople[highlightIndex])
    } else if (e.key === 'Escape') {
      setShowSuggestions(false)
      setHighlightIndex(-1)
    }
  }

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

  // app/people-roster: deliberately does NOT touch the `people` roster here.
  // Adding someone to "Who's joining" is provisional — they can still be
  // removed before Start session, or the screen abandoned entirely — so
  // resolving/creating a roster entry at this point would write someone to
  // the roster who never actually joined a session. Roster resolution
  // happens once, for the whole list, at the moment Start session is
  // actually clicked (see App.jsx's `handleStartSession`).
  // app/no-duplicate-participants: onAdd (useParticipants.addParticipant)
  // returns null for a name already on this list, same signal it already
  // used for a blank submission - surfaced here as an inline message
  // instead of just silently doing nothing, and the typed name is left in
  // place (not cleared) so it's obvious what got rejected.
  function handleSubmit(e) {
    e.preventDefault()
    const trimmedFirst = firstName.trim()
    if (!trimmedFirst) return
    const trimmedLast = lastName.trim()
    const fullName = trimmedLast ? `${trimmedFirst} ${trimmedLast}` : trimmedFirst
    const id = onAdd(fullName, null, trimmedFirst, trimmedLast || null)
    if (id == null) {
      setDuplicateError(`${fullName} is already on the list`)
      return
    }
    setDuplicateError(null)
    setFirstName('')
    setLastName('')
  }

  // app/drink-volume-required: a drink name without a volume used to be
  // accepted silently — the session would start, but with nothing for the
  // depletion bar/remaining-mL readout to measure against, which read as
  // a bug rather than an intentionally-optional field. Volume is now
  // required the moment a name is typed (still fine to leave the whole
  // Drink section blank — it's only required once you've committed to a
  // name).
  const drinkNameGiven = drinkName.trim() !== ''
  const drinkVolumeMissing = drinkNameGiven && parseVolumeToMl(drinkVolumeInput, drinkVolumeUnit) == null

  function handleStart() {
    // app/pass-limit-house-rule: blank/invalid/non-positive stays disabled
    // (null), matching useTurnManager's `passLimit` contract.
    const parsedLimit = parseInt(passLimitInput, 10)
    const passLimit = Number.isInteger(parsedLimit) && parsedLimit > 0 ? parsedLimit : null
    // app/drink-tracking (volume unit follow-up): amount + unit ->
    // whole mL via parseVolumeToMl, same blank/invalid -> null contract
    // as pass limit above.
    const drinkVolumeMl = parseVolumeToMl(drinkVolumeInput, drinkVolumeUnit)
    onStartSession(sessionName, passLimit, drinkName, drinkVolumeMl)
  }

  return (
    <div className="min-h-screen bg-ink px-6 py-10 text-paper">
      <div className="mx-auto max-w-md space-y-8">
        <header className="space-y-1 text-center">
          <h1 className="font-display text-3xl font-semibold tracking-tight text-paper">
            Lasenggo
          </h1>
          <p className="text-sm text-paper-dim">
            Add everyone joining this round before you start.
          </p>
          <div className="mt-3 flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={onViewHistory}
              className="flex items-center gap-1.5 rounded-lg bg-smoke px-3 py-1.5 text-sm text-paper-dim ring-1 ring-smoke-light transition hover:bg-smoke-light hover:text-paper active:scale-95"
            >
              <HistoryIcon />
              Session history
            </button>
            {/* app/people-roster: the roster screen (rename/delete) - new
                entries aren't added here, they're added organically by
                typing a new name in "Who's joining" below. */}
            <button
              type="button"
              onClick={onViewPeople}
              className="flex items-center gap-1.5 rounded-lg bg-smoke px-3 py-1.5 text-sm text-paper-dim ring-1 ring-smoke-light transition hover:bg-smoke-light hover:text-paper active:scale-95"
            >
              <PeopleIcon />
              People
            </button>
          </div>
        </header>

        <section className="space-y-3 rounded-2xl bg-smoke/60 p-4 ring-1 ring-smoke-light">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-sm font-semibold text-paper">Who's joining</h2>
            <span className="text-xs text-paper-dim">
              {participants.length} added
            </span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-2">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => {
                    setFirstName(e.target.value)
                    setShowSuggestions(true)
                    setHighlightIndex(-1)
                    setDuplicateError(null)
                  }}
                  onFocus={() => setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 100)}
                  onKeyDown={handleNameKeyDown}
                  placeholder="First name"
                  aria-label="First name"
                  autoComplete="off"
                  role="combobox"
                  aria-expanded={showSuggestions && filteredPeople.length > 0}
                  aria-controls="people-roster-options"
                  aria-autocomplete="list"
                  className="w-full rounded-xl bg-ink px-4 py-2 text-paper placeholder-paper-dim/60 outline-none ring-1 ring-smoke-light focus:ring-2 focus:ring-ember"
                />
                {/* app/people-roster (design pass): custom suggestion list,
                    styled to this app's own dark theme, in place of the native
                    <datalist> popup (browser chrome, couldn't be restyled, and
                    its dropdown arrow read as dated against the rest of this
                    screen). Suggestions are whoever's been tagayed with
                    before, most-recently-used first, filtered as you type;
                    arrow keys + Enter pick one, same as the native version did. */}
                {showSuggestions && filteredPeople.length > 0 && (
                  <ul
                    id="people-roster-options"
                    role="listbox"
                    className="absolute inset-x-0 top-full z-10 mt-1.5 overflow-hidden rounded-xl bg-smoke-light shadow-lg shadow-ink/50 ring-1 ring-smoke-light"
                  >
                    {filteredPeople.map((person, i) => (
                      <li key={person.id} role="option" aria-selected={i === highlightIndex}>
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => pickSuggestion(person)}
                          className={`block w-full px-4 py-2 text-left text-sm transition ${
                            i === highlightIndex
                              ? 'bg-ember/20 text-paper'
                              : 'text-paper-dim hover:bg-ink/40 hover:text-paper'
                          }`}
                        >
                          {person.name}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {/* app/participant-first-last-name: optional - someone can be
                  added with just a first name (matches the roster's own
                  optional last_name), filled in later if it matters. */}
              <input
                type="text"
                value={lastName}
                onChange={(e) => {
                  setLastName(e.target.value)
                  setDuplicateError(null)
                }}
                placeholder="Last name"
                aria-label="Last name"
                autoComplete="off"
                className="flex-1 rounded-xl bg-ink px-4 py-2 text-paper placeholder-paper-dim/60 outline-none ring-1 ring-smoke-light focus:ring-2 focus:ring-ember"
              />
            </div>
            <button
              type="submit"
              disabled={!firstName.trim()}
              className="w-full rounded-xl px-4 py-2 font-medium text-paper ring-1 ring-smoke-light transition hover:bg-smoke-light active:scale-95 disabled:opacity-30"
            >
              Add
            </button>
            {duplicateError && (
              <p className="px-1 text-xs text-maroon-dim">{duplicateError}</p>
            )}
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
                    isEditing={editingId === participant.id}
                    editFirst={editFirst}
                    editLast={editLast}
                    onStartEdit={() => startEditParticipant(participant)}
                    onChangeEditFirst={setEditFirst}
                    onChangeEditLast={setEditLast}
                    onSaveEdit={saveEditParticipant}
                    onCancelEdit={() => setEditingId(null)}
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

          {/* app/drink-tracking: what's being poured tonight — optional,
              manual log only (no depletion math from pours). Logged once
              here at Start Session, then the running session can log a
              change (same drink restocked, or a different one) from the
              "Now serving" row on ActiveSessionScreen. */}
          <div className="space-y-1">
            <label htmlFor="drink-name" className="text-xs text-paper-dim">
              Drink
            </label>
            <div className="flex flex-wrap gap-2">
              <input
                id="drink-name"
                type="text"
                value={drinkName}
                onChange={(e) => setDrinkName(e.target.value)}
                placeholder="e.g. Red Horse"
                className="min-w-[140px] flex-1 rounded-xl bg-ink px-4 py-2 text-paper placeholder-paper-dim/60 outline-none ring-1 ring-smoke-light focus:ring-2 focus:ring-ember"
              />
              <VolumeInput
                idPrefix="drink-volume"
                label="Drink volume"
                amount={drinkVolumeInput}
                unit={drinkVolumeUnit}
                onAmountChange={setDrinkVolumeInput}
                onUnitChange={setDrinkVolumeUnit}
                className="shrink-0"
              />
            </div>
            {drinkVolumeMissing && (
              <p className="px-1 text-xs text-maroon-dim">
                Add a volume for {drinkName.trim()}, or clear the name to skip drink tracking.
              </p>
            )}
          </div>
        </section>

        <button
          type="button"
          onClick={handleStart}
          disabled={participants.length < 2 || startingSession || drinkVolumeMissing}
          className="w-full rounded-xl bg-ember px-4 py-3 font-display text-lg font-semibold text-ink transition active:scale-[0.98] disabled:opacity-30"
        >
          {startingSession ? 'Starting…' : 'Start session'}
        </button>
      </div>
    </div>
  )
}
