import { useEffect, useRef, useState } from 'react'
import { useTurnManager } from './useTurnManager'
import { TurnRing } from './TurnRing'
import { SessionLog } from './SessionLog'
import { ParticipantManagerSheet } from './ParticipantManagerSheet'
import { usePourVolume, POUR_VOLUMES } from '../pour/usePourVolume'
import { BackIcon } from '../../shared/components/BackIcon'
import { HistoryIcon } from '../../shared/components/HistoryIcon'
import { PourVolumeSelector } from '../pour/PourVolumeSelector'
import {
  logEvent,
  deleteEvent,
  getSessionEvents,
  renameParticipant,
  addSessionParticipant,
  getCurrentDrink,
  addDrink,
  getQueuedDrink,
  promoteQueuedDrink,
  cancelQueuedDrink,
} from '../storage/sessionQueries'
import { findOrCreatePerson } from '../storage/peopleQueries'
import { VolumeInput } from '../../shared/components/VolumeInput'
import { parseVolumeToMl } from '../pour/volumeUnits'

/**
 * Active session screen.
 *
 * Pass advances turn order for real (`app/turn-manager`) and logs a PASS
 * event row to local SQLite (`app/local-event-logging`).
 *
 * Pour (`app/simulate-pour`) is also live, but simulated: there's no ESP32
 * yet (`app/ble-connect`/`app/ble-commands`/`app/ble-status-subscription`
 * are all still unstarted in TASKS.md), so `handlePour` stands in for the
 * real BLE round-trip with a fixed ~900ms delay before calling
 * `onPourConfirmed` — everything downstream of that (turn advance, event
 * logging, undo, session log, history) is the same code path the real
 * hardware will drive later. The status pill says "Simulated" rather than
 * faking a connection, so this build is never mistaken for hardware-ready.
 */
export function ActiveSessionScreen({
  participants,
  sessionId,
  sessionName,
  passLimit,
  onExit,
  onViewHistory,
  onRenameParticipant,
  onAddParticipant,
}) {
  // UX pass: live session log, shown in the SessionLog side panel — replaces
  // the old plain debug "events logged this session: N" readout with
  // something people actually asked for (who poured/passed, and when),
  // rather than a number only useful for eyeballing persistence during dev.
  const [events, setEvents] = useState([])

  function refreshEvents() {
    if (sessionId) getSessionEvents(sessionId).then(setEvents)
  }

  useEffect(refreshEvents, [sessionId])

  // app/drink-tracking: manual log only — no depletion math from pours.
  // `currentDrink` is just "the most recently started row" (see
  // getCurrentDrink); null if the session was started without one (the
  // feature is optional). `switching` toggles the inline "same / different
  // drink" panel below the "Now serving" row.
  const [currentDrink, setCurrentDrink] = useState(null)
  const [switching, setSwitching] = useState(false)
  const [switchName, setSwitchName] = useState('')
  const [switchVolumeInput, setSwitchVolumeInput] = useState('')
  const [switchVolumeUnit, setSwitchVolumeUnit] = useState('ml')

  // app/drink-queue: a drink staged ahead of time ("set this up now, switch
  // to it once the current one's empty") — separate from currentDrink/
  // switching above, which is the immediate "switch right now" path.
  const [queuedDrink, setQueuedDrink] = useState(null)
  const [queueName, setQueueName] = useState('')
  const [queueVolumeInput, setQueueVolumeInput] = useState('')
  const [queueVolumeUnit, setQueueVolumeUnit] = useState('ml')

  function refreshCurrentDrink() {
    if (sessionId) getCurrentDrink(sessionId).then(setCurrentDrink)
  }

  function refreshQueuedDrink() {
    if (sessionId) getQueuedDrink(sessionId).then(setQueuedDrink)
  }

  useEffect(refreshCurrentDrink, [sessionId])
  useEffect(refreshQueuedDrink, [sessionId])

  // app/drink-tracking (depletion follow-up): remaining volume is derived,
  // never stored — it's the declared volume_ml for the current "serving
  // period" (see getCurrentDrink) minus every POUR event logged since that
  // drink's started_at, mapped through POUR_VOLUMES the same way the
  // session log's own mL totals already are. Deliberately allowed to go
  // negative (Light/Standard/Heavy are approximations, so the last pour
  // can overshoot what's left) rather than clamped at 0 — see DECISIONS.md.
  // null (not 0) when the drink was logged without a volume, so the "Now
  // serving" row can tell "no volume given" apart from "exactly empty".
  const pouredMlSinceCurrentDrink = currentDrink
    ? events
        .filter((e) => e.type === 'POUR' && e.timestamp >= currentDrink.started_at)
        .reduce((sum, e) => sum + (POUR_VOLUMES.find((v) => v.id === e.volume)?.approxMl ?? 0), 0)
    : 0
  const remainingMl =
    currentDrink?.volume_ml != null ? currentDrink.volume_ml - pouredMlSinceCurrentDrink : null
  // isEmpty gates both the "X mL left" deficit styling and the "Up next"
  // banner's quiet-vs-urgent state; barWidthPct is the same fraction
  // clamped into a drawable [0, 100] range (the deficit itself is still
  // shown as a negative number in the text, just not as a negative bar).
  const isEmpty = remainingMl != null && remainingMl <= 0
  const barWidthPct =
    currentDrink?.volume_ml != null
      ? Math.max(0, Math.min(100, (remainingMl / currentDrink.volume_ml) * 100))
      : 0

  function handleSwitchSameDrink() {
    if (!sessionId || !currentDrink) return
    addDrink(sessionId, currentDrink.name, currentDrink.volume_ml)
      .then(refreshCurrentDrink)
      .catch((err) => console.error('Failed to log drink', err))
    setSwitching(false)
  }

  function openSwitchDifferentDrink() {
    setSwitchName('')
    setSwitchVolumeInput('')
    setSwitchVolumeUnit('ml')
    setSwitching(true)
  }

  function handleSwitchSubmit(e) {
    e.preventDefault()
    const trimmed = switchName.trim()
    if (!sessionId || !trimmed) return
    const volumeMl = parseVolumeToMl(switchVolumeInput, switchVolumeUnit)
    addDrink(sessionId, trimmed, volumeMl)
      .then(refreshCurrentDrink)
      .catch((err) => console.error('Failed to log drink', err))
    setSwitching(false)
  }

  // app/drink-queue: "Queue next drink" — stages a drink without touching
  // what's currently being served. Separate submit handler from the
  // "switch now" form above since this one passes status 'queued' and
  // refreshes queuedDrink, not currentDrink.
  function handleQueueSubmit(e) {
    e.preventDefault()
    const trimmed = queueName.trim()
    if (!sessionId || !trimmed) return
    const volumeMl = parseVolumeToMl(queueVolumeInput, queueVolumeUnit)
    addDrink(sessionId, trimmed, volumeMl, 'queued')
      .then(refreshQueuedDrink)
      .catch((err) => console.error('Failed to queue drink', err))
    setQueueName('')
    setQueueVolumeInput('')
    setQueueVolumeUnit('ml')
    setSwitching(false)
  }

  // app/drink-queue: the one-tap confirm that actually switches to the
  // queued drink — never automatic (see DECISIONS.md). Refreshes both
  // currentDrink (now the promoted one) and queuedDrink (now empty).
  function handlePromoteQueuedDrink() {
    if (!queuedDrink) return
    promoteQueuedDrink(queuedDrink.id)
      .then(() => {
        refreshCurrentDrink()
        refreshQueuedDrink()
      })
      .catch((err) => console.error('Failed to switch to queued drink', err))
  }

  function handleCancelQueuedDrink() {
    if (!queuedDrink) return
    cancelQueuedDrink(queuedDrink.id)
      .then(refreshQueuedDrink)
      .catch((err) => console.error('Failed to cancel queued drink', err))
  }

  // app/undo-last-action: the event this device most recently logged, kept
  // just long enough to undo it (one level only — cleared once undone or
  // once the next action happens, since the snapshot below is one-level too).
  const [lastEvent, setLastEvent] = useState(null)

  // app/simulate-pour: no ESP32/BLE yet (hardware isn't built — TASKS.md),
  // but the full Pour flow (turn advance, event logging, undo, session log,
  // history) is otherwise done and untestable without it. Rather than wait
  // on hardware, Pour is enabled here against a simulated ~900ms "pouring"
  // delay instead of a real BLE round-trip, so the UI/data flow can be
  // exercised end-to-end now. Swap this for the real `app/ble-commands` +
  // `app/ble-status-subscription` round-trip later — `onPourConfirmed`
  // itself (useTurnManager) and the event-logging `onEvent` callback below
  // don't change, only what triggers the confirmation does.
  const [isPouring, setIsPouring] = useState(false)

  // app/confirm-exit-session: "Back" used to call onExit directly, which
  // ends the session in the DB right away — one stray tap during a round
  // and there was no way back to it. Now it's a three-stage confirm
  // instead of a one-tap exit: 'idle' (plain Back button) -> 'confirm'
  // (Back has expanded into "Keep going" / "End session") -> 'final' (a
  // second, explicit "can't be undone" warning before onExit actually
  // runs) — so neither the original stray tap nor a stray tap on the
  // newly-exposed "End session" link can end the round by accident.
  const [exitStage, setExitStage] = useState('idle')
  const confirmingExit = exitStage !== 'idle'

  // app/pause-participant: the *rotation-skipping* state is session-scoped
  // only (never persisted, never affects the shared roster) — a plain Set
  // is all useTurnManager needs. The *reason* a pause happened, though, is
  // worth keeping even after the pause ends — someone who went home or
  // snuck off (takas) mid-tagay isn't coming back to Resume, so if that
  // reason only lived in memory it'd vanish the moment the session ends.
  // It's logged as a real PAUSE event (app/pause-reason-tag) alongside
  // POUR/PASS, so it survives in this session's Activity log/History same
  // as everything else that happened tonight.
  const [pausedIds, setPausedIds] = useState(() => new Set())
  const [pauseReasons, setPauseReasons] = useState({})
  const [managingParticipants, setManagingParticipants] = useState(false)

  // Pausing requires a reason (the whole point — tag it right away, in
  // case this is the last anyone hears from them tonight); resuming
  // doesn't need one, it's just "they're back".
  function pauseParticipant(id, reason) {
    setPausedIds((prev) => new Set(prev).add(id))
    setPauseReasons((prev) => ({ ...prev, [id]: reason }))
    if (sessionId) {
      logEvent(sessionId, id, 'PAUSE', null, reason)
        .then(refreshEvents)
        .catch((err) => console.error('Failed to log pause event', err))
    }
  }

  function resumeParticipant(id) {
    setPausedIds((prev) => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
    setPauseReasons((prev) => {
      const { [id]: _removed, ...rest } = prev
      return rest
    })
    if (sessionId) {
      logEvent(sessionId, id, 'RESUME')
        .then(refreshEvents)
        .catch((err) => console.error('Failed to log resume event', err))
    }
  }

  // app/edit-participant-name: updates both halves of the one id — the
  // in-memory roster (so the ring/log reflect it immediately) and the DB
  // row for this session (so History picks it up too).
  function handleRename(id, name) {
    onRenameParticipant?.(id, name)
    if (sessionId) renameParticipant(id, name.trim()).catch((err) => console.error('Failed to rename participant', err))
  }

  // app/add-participant-mid-session: someone joins the table after the
  // round's already started — adds them to the live participant list (so
  // the ring/log pick them up right away, same as if they'd been in the
  // original list) and inserts their DB row for *this* session, same shape
  // createSession would have inserted had they been there from the start.
  // app/people-roster: also resolves/creates their roster entry first
  // (same as ParticipantList's own add), so someone added mid-session
  // shows up in autocomplete next time too, not just people added at
  // Start Session.
  async function handleAddParticipant(name) {
    const trimmed = name.trim()
    if (!trimmed) return
    let personId = null
    try {
      personId = await findOrCreatePerson(trimmed, '')
    } catch (err) {
      console.error('Failed to resolve roster person, adding without one', err)
    }
    const id = onAddParticipant?.(trimmed, personId)
    if (id && sessionId) {
      addSessionParticipant(sessionId, id, trimmed, personId).catch((err) =>
        console.error('Failed to add participant to session', err),
      )
    }
  }

  const activeCount = participants.length - pausedIds.size

  // Session log breakdown (Light/Standard/Heavy, mL) needs to know which
  // volume was selected *at the moment of a pour* — read via a ref inside
  // onEvent below rather than a dependency, so this callback doesn't need
  // to be recreated (and passed back into useTurnManager) every time the
  // selector changes.
  const { volumeId, setVolumeId } = usePourVolume()
  const volumeIdRef = useRef(volumeId)
  volumeIdRef.current = volumeId

  const {
    current,
    currentIndex,
    onPass,
    onPourConfirmed,
    currentPassStreak,
    isOverPassLimit,
    canUndo,
    undoTurn,
  } = useTurnManager(participants, {
    passLimit,
    pausedIds,
    onEvent: (type, participant) => {
      const volume = type === 'POUR' ? volumeIdRef.current : null
      logEvent(sessionId, participant.id, type, volume)
        .then((eventId) => {
          setLastEvent({ id: eventId, type, participant })
          refreshEvents()
        })
        .catch((err) => console.error(`Failed to log ${type} event`, err))
    },
  })

  function handleUndo() {
    if (!canUndo || !lastEvent) return
    undoTurn()
    deleteEvent(lastEvent.id)
      .then(refreshEvents)
      .catch((err) => console.error('Failed to delete undone event', err))
    setLastEvent(null)
  }

  // app/simulate-pour: stands in for the real BLE round-trip (send POUR
  // command -> wait for STATUS: POURED) until `app/ble-commands` +
  // `app/ble-status-subscription` exist. Guarded by `isPouring` so a
  // double-click can't fire two pours for the same turn.
  function handlePour() {
    if (isPouring) return
    setIsPouring(true)
    setTimeout(() => {
      onPourConfirmed()
      setIsPouring(false)
    }, 900)
  }

  return (
    <div className="min-h-screen bg-ink px-6 py-10 text-paper">
      {/* UX pass: wider on desktop/tablet so the session log has real room
          beside the turn ring; the two columns stack (log below) on a
          phone-width viewport, which is this app's primary target. */}
      <div className="mx-auto grid max-w-3xl gap-8 md:grid-cols-[minmax(0,1fr)_280px] md:items-start">
        <div className="flex flex-col items-center gap-7">
          {/* app/confirm-exit-session: Back expands in place into a confirm
              bar (absolute overlay, origin-left scale animation) rather
              than swapping to a native dialog or reflowing the layout —
              it reads as the Back button unfolding rightward. The
              Participants/Session-history row fades out while this is
              open (rather than just sitting there to be covered) so the
              bar never has anything behind it to overlap, and its width
              is capped so it can't run past the edge of a narrow phone
              screen either.
              "Keep going" is the one safe, prominent (ember-filled, auto-
              focused) action; "End session" is deliberately a plain
              warning-colored link, not a filled button, so an accidental
              second tap in the same spot can't repeat the mistake. */}
          <div className="flex w-full items-start justify-between">
            <div className="relative max-w-full">
              <button
                type="button"
                onClick={() => setExitStage('confirm')}
                aria-label="Back to participants"
                aria-hidden={confirmingExit}
                tabIndex={confirmingExit ? -1 : 0}
                className={`flex items-center gap-1.5 rounded-full bg-smoke px-3 py-1.5 text-sm text-paper-dim ring-1 ring-smoke-light transition-all duration-[220ms] ease-out hover:bg-smoke-light hover:text-paper active:scale-95 ${
                  confirmingExit
                    ? 'pointer-events-none scale-95 opacity-0 delay-0'
                    : 'scale-100 opacity-100 delay-150'
                }`}
              >
                <BackIcon /> Back
              </button>

              <div
                aria-hidden={!confirmingExit}
                className={`absolute left-0 top-0 z-10 flex w-max max-w-[min(22rem,80vw)] origin-left flex-wrap items-center gap-2 rounded-2xl px-3 py-1.5 text-sm ring-1 transition-all duration-[220ms] ease-out ${
                  exitStage === 'final' ? 'bg-maroon/15 ring-maroon/40' : 'bg-smoke ring-smoke-light'
                } ${
                  confirmingExit
                    ? 'pointer-events-auto scale-x-100 opacity-100'
                    : 'pointer-events-none scale-x-0 opacity-0'
                }`}
              >
                {exitStage === 'final' ? (
                  <>
                    <span className="text-maroon-dim">End for good?</span>
                    <button
                      type="button"
                      onClick={onExit}
                      tabIndex={exitStage === 'final' ? 0 : -1}
                      className="rounded-full bg-maroon px-2.5 py-1 text-xs font-semibold text-paper transition active:scale-95"
                    >
                      Yes, end session
                    </button>
                    <button
                      type="button"
                      onClick={() => setExitStage('confirm')}
                      tabIndex={exitStage === 'final' ? 0 : -1}
                      autoFocus={exitStage === 'final'}
                      className="rounded-full px-2.5 py-1 text-xs text-paper-dim transition hover:text-paper active:scale-95"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <span className="text-paper-dim">End session?</span>
                    <button
                      type="button"
                      onClick={() => setExitStage('idle')}
                      tabIndex={exitStage === 'confirm' ? 0 : -1}
                      autoFocus={exitStage === 'confirm'}
                      className="rounded-full bg-ember px-2.5 py-1 text-xs font-semibold text-ink transition active:scale-95"
                    >
                      Keep going
                    </button>
                    <button
                      type="button"
                      onClick={() => setExitStage('final')}
                      tabIndex={exitStage === 'confirm' ? 0 : -1}
                      className="flex items-center gap-1 rounded-full px-2 py-1 text-xs text-maroon-dim transition hover:bg-maroon/10 hover:text-maroon active:scale-95"
                    >
                      <span aria-hidden="true">⚠</span> End session
                    </button>
                  </>
                )}
              </div>
            </div>

            <div
              className={`flex items-center gap-2 transition-all duration-[220ms] ease-out ${
                confirmingExit ? 'pointer-events-none opacity-0' : 'opacity-100'
              }`}
            >
              <button
                type="button"
                onClick={() => setManagingParticipants(true)}
                tabIndex={confirmingExit ? -1 : 0}
                className="flex items-center gap-1.5 rounded-lg bg-smoke px-3 py-1.5 text-sm text-paper-dim ring-1 ring-smoke-light transition hover:bg-smoke-light hover:text-paper active:scale-95"
              >
                Participants
              </button>
              <button
                type="button"
                onClick={onViewHistory}
                tabIndex={confirmingExit ? -1 : 0}
                className="flex items-center gap-1.5 rounded-lg bg-smoke px-3 py-1.5 text-sm text-paper-dim ring-1 ring-smoke-light transition hover:bg-smoke-light hover:text-paper active:scale-95"
              >
                <HistoryIcon />
                Session history
              </button>
            </div>
          </div>

          {managingParticipants && (
            <ParticipantManagerSheet
              participants={participants}
              pausedIds={pausedIds}
              pauseReasons={pauseReasons}
              onRename={handleRename}
              onPause={pauseParticipant}
              onResume={resumeParticipant}
              onAdd={handleAddParticipant}
              onClose={() => setManagingParticipants(false)}
            />
          )}

          {/* app/session-naming: only rendered when a name was given at
              Start Session — a blank name stays date-only everywhere else too.
              UX pass: promoted from a small pill to the page's actual title —
              it's what everyone at the table calls this round, so it should
              read like one, with the status pill demoted underneath it. */}
          {sessionName && (
            <h1 className="max-w-full truncate px-2 text-center font-display text-4xl font-semibold tracking-tight text-paper">
              {sessionName}
            </h1>
          )}

          {/* app/drink-tracking (+ app/drink-queue follow-ups): "Now
              serving" sits right below the session name, before the status
              pill. Hidden entirely if drink tracking wasn't used at Start
              Session (currentDrink stays null). */}
          {currentDrink && (
            <div className="w-full max-w-md space-y-2">
              <div className="space-y-1.5 rounded-2xl bg-smoke px-4 py-2.5 ring-1 ring-smoke-light">
                <div className="flex flex-wrap items-center justify-center gap-2 text-sm text-paper-dim">
                  <span className="text-paper">
                    Now serving: {currentDrink.name}
                    {remainingMl != null && (
                      <span className={isEmpty ? 'text-maroon-dim' : ''}>
                        {' '}· {remainingMl}mL left
                      </span>
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={() => (switching ? setSwitching(false) : setSwitching(true))}
                    className="rounded-full bg-smoke-light px-2.5 py-1 text-xs font-medium text-paper transition hover:bg-ember hover:text-ink active:scale-95"
                  >
                    Switch
                  </button>
                </div>
                {/* app/drink-queue: visual depletion bar — only drawn when
                    a volume was actually declared (remainingMl null means
                    the drink was logged without one, so there's nothing to
                    show a fraction of). Clamped to [0, 100]% for the bar
                    width itself even though remainingMl can go negative —
                    the number next to "Now serving" above is what carries
                    the deficit, the bar just reads as "empty" at that point
                    rather than trying to draw a negative-width sliver. */}
                {currentDrink.volume_ml != null && (
                  <div className="h-2 w-full overflow-hidden rounded-full bg-ink">
                    <div
                      className={`h-full rounded-full transition-[width] duration-500 ease-out ${isEmpty ? 'bg-maroon' : 'bg-ember'}`}
                      style={{ width: `${barWidthPct}%` }}
                    />
                  </div>
                )}
              </div>

              {/* app/drink-queue: "Up next" — a drink staged ahead of time,
                  separate from the immediate "switch now" panel below.
                  Quiet (smoke-toned) while the current drink still has
                  volume left; switches to the maroon-toned empty state
                  once isEmpty, since that's the moment "Switch now" here
                  actually matters — still just a passive row, never a
                  popup (see DECISIONS.md), so nothing happens without the
                  tap. */}
              {queuedDrink && (
                <div
                  className={`flex flex-wrap items-center justify-center gap-2 rounded-full px-4 py-2 text-sm ring-1 ${
                    isEmpty
                      ? 'bg-maroon/15 text-maroon-dim ring-maroon/40'
                      : 'bg-smoke/60 text-paper-dim ring-smoke-light'
                  }`}
                >
                  <span>
                    {isEmpty ? `${currentDrink.name} is empty · switch to` : 'Up next:'}{' '}
                    <span className={isEmpty ? 'text-paper' : 'text-paper'}>
                      {queuedDrink.name}
                    </span>
                    {queuedDrink.volume_ml ? ` · ${queuedDrink.volume_ml}mL` : ''}
                    {isEmpty ? '?' : ''}
                  </span>
                  <button
                    type="button"
                    onClick={handlePromoteQueuedDrink}
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold transition active:scale-95 ${
                      isEmpty ? 'bg-maroon text-paper' : 'bg-smoke-light text-paper hover:bg-ember hover:text-ink'
                    }`}
                  >
                    Switch now
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelQueuedDrink}
                    className="rounded-full px-2 py-1 text-xs text-paper-dim/70 transition hover:text-paper"
                  >
                    Cancel
                  </button>
                </div>
              )}

              {switching && (
                <div className="space-y-3 rounded-2xl bg-smoke/60 p-3 ring-1 ring-smoke-light">
                  <div className="space-y-2">
                    <p className="px-1 text-xs text-paper-dim">Ran out right now? Switch immediately.</p>
                    <button
                      type="button"
                      onClick={handleSwitchSameDrink}
                      className="w-full rounded-xl px-4 py-2 text-sm font-medium text-paper ring-1 ring-smoke-light transition hover:bg-smoke-light active:scale-95"
                    >
                      Same drink{currentDrink.volume_ml ? ` · ${currentDrink.volume_ml}mL` : ''} (new bottle)
                    </button>
                    <form onSubmit={handleSwitchSubmit} className="flex gap-2">
                      <input
                        type="text"
                        value={switchName}
                        onChange={(e) => setSwitchName(e.target.value)}
                        placeholder="Different drink"
                        aria-label="Different drink name"
                        className="flex-1 rounded-xl bg-ink px-3 py-2 text-sm text-paper placeholder-paper-dim/60 outline-none ring-1 ring-smoke-light focus:ring-2 focus:ring-ember"
                      />
                      <VolumeInput
                        idPrefix="switch-drink-volume"
                        label="Different drink volume"
                        amount={switchVolumeInput}
                        unit={switchVolumeUnit}
                        onAmountChange={setSwitchVolumeInput}
                        onUnitChange={setSwitchVolumeUnit}
                      />
                      <button
                        type="submit"
                        disabled={!switchName.trim()}
                        className="rounded-xl bg-ember px-3 py-2 text-sm font-semibold text-ink transition active:scale-95 disabled:opacity-30"
                      >
                        Log
                      </button>
                    </form>
                  </div>

                  {/* app/drink-queue: stage a drink ahead of time instead of
                      switching to it right now — doesn't touch currentDrink
                      at all, just shows up as "Up next" above until
                      promoted (one tap) or cancelled. */}
                  <div className="space-y-2 border-t border-smoke-light pt-3">
                    <p className="px-1 text-xs text-paper-dim">
                      Not empty yet? Set up the next one for later.
                    </p>
                    <form onSubmit={handleQueueSubmit} className="flex gap-2">
                      <input
                        type="text"
                        value={queueName}
                        onChange={(e) => setQueueName(e.target.value)}
                        placeholder="Next drink"
                        aria-label="Next drink name"
                        className="flex-1 rounded-xl bg-ink px-3 py-2 text-sm text-paper placeholder-paper-dim/60 outline-none ring-1 ring-smoke-light focus:ring-2 focus:ring-ember"
                      />
                      <VolumeInput
                        idPrefix="queue-drink-volume"
                        label="Next drink volume"
                        amount={queueVolumeInput}
                        unit={queueVolumeUnit}
                        onAmountChange={setQueueVolumeInput}
                        onUnitChange={setQueueVolumeUnit}
                      />
                      <button
                        type="submit"
                        disabled={!queueName.trim()}
                        className="rounded-xl px-3 py-2 text-sm font-semibold text-paper ring-1 ring-smoke-light transition hover:bg-smoke-light active:scale-95 disabled:opacity-30"
                      >
                        Queue
                      </button>
                    </form>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* app/simulate-pour: no ESP32 to report a real STATUS yet
              (TASKS.md's BLE tasks are still unstarted), so this stays
              honest about it instead of showing a fake "Connected" —
              amber dot + "Simulated" label, swapping to a brighter pulse +
              "Pouring…" for the simulated delay so the pill still reflects
              what's actually happening turn to turn. */}
          <div className="flex items-center gap-2 rounded-full bg-smoke px-4 py-1.5 text-xs font-medium text-paper-dim">
            <span
              className={`h-2 w-2 rounded-full ${isPouring ? 'animate-pulse bg-ember' : 'bg-ember/50'}`}
            />
            {isPouring ? 'Pouring…' : 'Simulated — no hardware connected'}
          </div>

          <TurnRing participants={participants} currentIndex={currentIndex} current={current} pausedIds={pausedIds} />

          {/* app/pass-limit-house-rule: soft warning only — Pass stays enabled
              and Pour (simulated, app/simulate-pour) is the real next step. */}
          {isOverPassLimit && (
            <p className="rounded-xl bg-maroon/15 px-4 py-2 text-center text-sm text-maroon-dim ring-1 ring-maroon/40">
              House rule: {current?.name} has passed {currentPassStreak}x in a row
            </p>
          )}

          <div className="w-full max-w-md space-y-2">
            <p className="text-center text-xs text-paper-dim">Pour volume</p>
            <PourVolumeSelector volumeId={volumeId} onChange={setVolumeId} />
          </div>

          {/* app/simulate-pour: Pour is now a real action too (simulated,
              see handlePour) — both buttons are equally "live" so neither
              reads as the dead end Pour used to be. Pour disables itself
              only for the ~900ms of its own simulated pour, so a stray
              double-tap can't double-log it; Pass stays always-available. */}
          <div className="grid w-full max-w-md grid-cols-2 gap-4">
            <button
              type="button"
              onClick={onPass}
              disabled={isPouring}
              className="rounded-xl bg-ember px-6 py-5 text-lg font-display font-semibold text-ink transition active:scale-95 disabled:opacity-40"
            >
              Pass
            </button>
            <button
              type="button"
              onClick={handlePour}
              disabled={isPouring}
              title="Simulated — no hardware connected yet"
              className="rounded-xl bg-smoke px-6 py-5 text-lg font-display font-semibold text-paper ring-1 ring-smoke-light transition active:scale-95 disabled:opacity-60"
            >
              {isPouring ? 'Pouring…' : 'Pour'}
            </button>
          </div>

          {/* app/undo-last-action: only one level deep, and only for the
              event this device itself just logged — not a history stack.
              Fixed-height slot + opacity/scale fade (rather than mounting and
              unmounting the button) so the layout below doesn't jump every
              time someone passes, and the undo affordance reads as a real
              tappable control instead of a stray line of text. */}
          <div className="flex h-9 w-full items-center justify-center">
            <button
              type="button"
              onClick={handleUndo}
              disabled={!canUndo || !lastEvent}
              aria-hidden={!(canUndo && lastEvent)}
              tabIndex={canUndo && lastEvent ? 0 : -1}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs text-paper-dim ring-1 ring-smoke-light transition hover:bg-smoke-light hover:text-paper active:scale-95 ${
                canUndo && lastEvent ? 'opacity-100' : 'pointer-events-none opacity-0'
              }`}
            >
              <span aria-hidden="true">↺</span>
              Undo {lastEvent?.type === 'POUR' ? 'pour' : 'pass'} by {lastEvent?.participant.name}
            </button>
          </div>

          <p className="text-center text-xs text-paper-dim/60">
            {activeCount} participant{activeCount === 1 ? '' : 's'} in this round
            {pausedIds.size > 0 && ` (+${pausedIds.size} paused)`}
          </p>
        </div>

        <SessionLog
          events={events}
          participants={participants}
          currentParticipantId={current?.id}
          pausedIds={pausedIds}
          pauseReasons={pauseReasons}
        />
      </div>
    </div>
  )
}
