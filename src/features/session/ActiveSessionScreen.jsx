import { useEffect, useRef, useState } from 'react'
import { useTurnManager } from './useTurnManager'
import { useTurnTimer } from './useTurnTimer'
import { TurnRing } from './TurnRing'
import { SessionLog } from './SessionLog'
import { ParticipantManagerSheet } from './ParticipantManagerSheet'
import { usePourVolume, POUR_VOLUMES } from '../pour/usePourVolume'
import { BackIcon } from '../../shared/components/BackIcon'
import { HistoryIcon } from '../../shared/components/HistoryIcon'
import { EditIcon } from '../../shared/components/EditIcon'
import { TrashIcon } from '../../shared/components/TrashIcon'
import { SwitchIcon } from '../../shared/components/SwitchIcon'
import { TimerIcon } from '../../shared/components/TimerIcon'
import { PourVolumeSelector } from '../pour/PourVolumeSelector'
import { playBuzzer } from '../../shared/playBuzzer'
import {
  logEvent,
  deleteEvent,
  getSessionEvents,
  renameParticipant,
  addSessionParticipant,
  getCurrentDrink,
  addDrink,
  updateDrink,
  getQueuedDrinks,
  switchToDrink,
  cancelQueuedDrink,
  getSessionDrinkHistory,
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

  // app/drink-queue (+ app/drink-queue-list): drinks staged ahead of time
  // ("set this up now, switch to it once the current one's empty") —
  // separate from currentDrink/switching above, which is the immediate
  // "switch right now" path. A real multi-item queue now, not a single
  // slot — queuing a new drink, or demoting the current one while it
  // still has volume, both just add another row rather than replacing
  // whatever's already staged.
  const [queuedDrinks, setQueuedDrinks] = useState([])
  const [queueName, setQueueName] = useState('')
  const [queueVolumeInput, setQueueVolumeInput] = useState('')
  const [queueVolumeUnit, setQueueVolumeUnit] = useState('ml')

  // app/drink-queue-list: which "Up next" row (by id) is currently showing
  // its inline edit form instead of its normal display, if any — at most
  // one at a time, same single-editor-open convention the roster/People
  // screens already use elsewhere in this app.
  const [editingQueuedId, setEditingQueuedId] = useState(null)
  const [editName, setEditName] = useState('')
  const [editVolumeInput, setEditVolumeInput] = useState('')
  const [editVolumeUnit, setEditVolumeUnit] = useState('ml')

  // app/drink-queue-list (UX pass): deleting a queued drink is permanent
  // and there's no undo for it (unlike logged Pour/Pass events), so a tap
  // on the trash icon arms a same-row "Delete this?" confirm instead of
  // deleting immediately — a second explicit tap is required. Keeping it
  // inline rather than a popup/dialog, same convention as the rest of this
  // list (see DECISIONS.md).
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)

  // app/drink-queue-list (UX pass: long queues): with the queue capable
  // of holding any number of drinks, showing every row inline doesn't
  // scale — the card would grow without bound and push the rest of the
  // screen down. Only the single most-urgent row (the oldest-staged one)
  // shows by default; the rest collapse behind a "+N more queued" toggle
  // and only render once the person actually asks to see them.
  const [queueExpanded, setQueueExpanded] = useState(false)

  // app/drink-switchback: every drink actually served this session
  // (current + history), used to list "past drinks" you can switch back
  // to from the Switch dialog — see getSessionDrinkHistory. Each one's
  // remaining volume is computed below from `events` (now that pours are
  // tagged with the drink they were poured against, drink_id), not
  // re-fetched per row.
  const [drinkHistory, setDrinkHistory] = useState([])

  function refreshCurrentDrink() {
    if (sessionId) getCurrentDrink(sessionId).then(setCurrentDrink)
  }

  function refreshQueuedDrinks() {
    if (sessionId) getQueuedDrinks(sessionId).then(setQueuedDrinks)
  }

  function refreshDrinkHistory() {
    if (sessionId) getSessionDrinkHistory(sessionId).then(setDrinkHistory)
  }

  useEffect(refreshCurrentDrink, [sessionId])
  useEffect(refreshQueuedDrinks, [sessionId])
  useEffect(refreshDrinkHistory, [sessionId])

  // app/drink-tracking (depletion follow-up): remaining volume is derived,
  // never stored — it's the declared volume_ml for the current "serving
  // period" (see getCurrentDrink) minus every POUR event logged since that
  // drink's started_at, mapped through POUR_VOLUMES the same way the
  // session log's own mL totals already are. Deliberately allowed to go
  // negative (Light/Standard/Heavy are approximations, so the last pour
  // can overshoot what's left) rather than clamped at 0 — see DECISIONS.md.
  // null (not 0) when the drink was logged without a volume, so the "Now
  // serving" row can tell "no volume given" apart from "exactly empty".
  // app/drink-switchback: remaining volume for ANY drink (not just the
  // current one) is its declared volume_ml minus every POUR event tagged
  // with its id — drink_id, stamped at log time (see onEvent below) —
  // rather than "every pour since this row's started_at", which is what
  // this used to be. That timestamp-based version broke the moment a
  // session could switch back to an earlier drink: pours made against a
  // *different* drink in between would still fall after the old row's
  // started_at and get wrongly counted against it. Tagging each pour with
  // the exact drink it was poured against sidesteps that entirely, no
  // matter how many times a session switches back and forth.
  function remainingForDrink(drink) {
    if (!drink || drink.volume_ml == null) return null
    const pouredMl = events
      .filter((e) => e.type === 'POUR' && e.drink_id === drink.id)
      .reduce((sum, e) => sum + (POUR_VOLUMES.find((v) => v.id === e.volume)?.approxMl ?? 0), 0)
    return drink.volume_ml - pouredMl
  }

  const remainingMl = remainingForDrink(currentDrink)

  // app/drink-switchback: the "switch back to a past drink" picker list —
  // every drink this session has ever been "Now serving", except whichever
  // one that is *right now* — newest-started first so the most recently
  // left-behind drink is the easiest one to find. A 'queued' row never
  // shows up here (getSessionDrinkHistory only selects 'serving'/
  // 'served') — app/drink-queue-list gave "Up next" its own dedicated
  // list with its own Switch now/edit/delete, so a staged drink has a
  // single home instead of appearing in two different lists at once.
  const pastDrinks = drinkHistory
    .filter((d) => d.id !== currentDrink?.id)
    .slice()
    .reverse()
  // isEmpty gates both the "X mL left" deficit styling and the "Up next"
  // list's quiet-vs-urgent state; barWidthPct is the same fraction
  // clamped into a drawable [0, 100] range (the deficit itself is still
  // shown as a negative number in the text, just not as a negative bar).
  const isEmpty = remainingMl != null && remainingMl <= 0
  // app/drink-queue-list: the oldest-queued ("first in line") drink is the
  // one spotlighted with the urgent "switch to?" prompt once isEmpty —
  // the rest of the queue still shows normally below it.
  const nextQueuedDrink = queuedDrinks[0] ?? null

  // app/drink-session-log: every drink this session has touched, for the
  // SessionLog panel's "Drinks" section — drinkHistory already covers
  // 'serving' + 'served' (getSessionDrinkHistory), queuedDrinks covers
  // 'queued' but doesn't select a `status` column at all (every row from
  // it is queued by definition), so it's stamped on here rather than in
  // SQL. Merged and ordered oldest-first by started_at so the list reads
  // as "what happened, in order" instead of two disjoint lists glued
  // together.
  const allDrinksForLog = [
    ...drinkHistory,
    ...queuedDrinks.map((d) => ({ ...d, status: 'queued' })),
  ].sort((a, b) => new Date(a.started_at) - new Date(b.started_at))
  const barWidthPct =
    currentDrink?.volume_ml != null
      ? Math.max(0, Math.min(100, (remainingMl / currentDrink.volume_ml) * 100))
      : 0

  function handleSwitchSameDrink() {
    if (!sessionId || !currentDrink) return
    addDrink(sessionId, currentDrink.name, currentDrink.volume_ml)
      .then(() => {
        refreshCurrentDrink()
        refreshQueuedDrinks()
        refreshDrinkHistory()
      })
      .catch((err) => console.error('Failed to log drink', err))
    setSwitching(false)
  }

  function openSwitchDifferentDrink() {
    setSwitchName('')
    setSwitchVolumeInput('')
    setSwitchVolumeUnit('ml')
    setSwitching(true)
  }

  // app/drink-volume-required: same rule as "Who's joining" — a drink
  // name without a volume used to switch silently, leaving the depletion
  // bar/remaining-mL readout with nothing to measure against. Required
  // the moment a name is typed; still fine to leave the whole field blank.
  const switchVolumeMissing =
    switchName.trim() !== '' && parseVolumeToMl(switchVolumeInput, switchVolumeUnit) == null

  function handleSwitchSubmit(e) {
    e.preventDefault()
    const trimmed = switchName.trim()
    const volumeMl = parseVolumeToMl(switchVolumeInput, switchVolumeUnit)
    if (!sessionId || !trimmed || volumeMl == null) return
    addDrink(sessionId, trimmed, volumeMl)
      .then(() => {
        refreshCurrentDrink()
        refreshQueuedDrinks()
        refreshDrinkHistory()
      })
      .catch((err) => console.error('Failed to log drink', err))
    // Pre-existing gap fixed alongside app/drink-switchback: this form
    // never cleared itself on submit (unlike the queue form below, which
    // always has), so the next time the dialog opened, typing a new name
    // appended onto whatever was left over instead of starting fresh.
    setSwitchName('')
    setSwitchVolumeInput('')
    setSwitchVolumeUnit('ml')
    setSwitching(false)
  }

  // app/drink-queue (+ app/drink-queue-list): "Queue next drink" — stages
  // a drink without touching what's currently being served, adding
  // another row to the queue rather than replacing whatever's already
  // there. Separate submit handler from the "switch now" form above since
  // this one passes status 'queued' and refreshes queuedDrinks, not
  // currentDrink.
  const queueVolumeMissing =
    queueName.trim() !== '' && parseVolumeToMl(queueVolumeInput, queueVolumeUnit) == null

  function handleQueueSubmit(e) {
    e.preventDefault()
    const trimmed = queueName.trim()
    const volumeMl = parseVolumeToMl(queueVolumeInput, queueVolumeUnit)
    if (!sessionId || !trimmed || volumeMl == null) return
    addDrink(sessionId, trimmed, volumeMl, 'queued')
      .then(refreshQueuedDrinks)
      .catch((err) => console.error('Failed to queue drink', err))
    // app/drink-switchback: queuing never demotes the current drink, so
    // drinkHistory doesn't need refreshing here — unlike the "serving"
    // paths above, which can quietly turn the old current drink into a
    // history/requeued row.
    setQueueName('')
    setQueueVolumeInput('')
    setQueueVolumeUnit('ml')
    setSwitching(false)
  }

  // app/drink-queue: the one-tap confirm that actually switches to a
  // queued drink — never automatic (see DECISIONS.md). `drinkId` is now
  // required (app/drink-queue-list: more than one row can be queued at
  // once, so "the" queued drink is no longer a single implicit target).
  function handlePromoteQueuedDrink(drinkId) {
    if (!sessionId || !drinkId) return
    switchToDrink(sessionId, drinkId)
      .then(() => {
        refreshCurrentDrink()
        refreshQueuedDrinks()
        refreshDrinkHistory()
      })
      .catch((err) => console.error('Failed to switch to queued drink', err))
    setConfirmDeleteId(null)
  }

  // app/drink-queue-list: opens the inline edit form for one "Up next"
  // row, prefilled from its current name/volume. `volume_ml` is stored as
  // a plain mL integer, so the edit form always reopens in mL regardless
  // of which unit it was originally entered in — same tradeoff the rest
  // of this app already accepts (VolumeInput is an input-time convenience
  // only; nothing downstream remembers the original unit).
  function openEditQueuedDrink(drink) {
    setConfirmDeleteId(null)
    setEditingQueuedId(drink.id)
    setEditName(drink.name)
    setEditVolumeInput(drink.volume_ml != null ? String(drink.volume_ml) : '')
    setEditVolumeUnit('ml')
  }

  function closeEditQueuedDrink() {
    setEditingQueuedId(null)
    setEditName('')
    setEditVolumeInput('')
    setEditVolumeUnit('ml')
  }

  // app/drink-queue-list (UX pass): first tap arms the row's delete
  // confirm, a second tap (on the confirm button, below) actually deletes.
  // Tapping anything else on the row — Edit, Switch now, or arming a
  // different row's confirm — disarms it, so at most one row is ever
  // armed at a time and nothing stays armed longer than the user's
  // attention is actually on it.
  function armDeleteQueuedDrink(drinkId) {
    setEditingQueuedId(null)
    setConfirmDeleteId(drinkId)
  }

  function disarmDeleteQueuedDrink() {
    setConfirmDeleteId(null)
  }

  // app/drink-volume-required: same rule as every other drink form in
  // this app — a name without a volume doesn't save.
  const editVolumeMissing =
    editName.trim() !== '' && parseVolumeToMl(editVolumeInput, editVolumeUnit) == null

  function handleEditQueuedSubmit(e) {
    e.preventDefault()
    const trimmed = editName.trim()
    const volumeMl = parseVolumeToMl(editVolumeInput, editVolumeUnit)
    if (!editingQueuedId || !trimmed || volumeMl == null) return
    // app/drink-edit-current: this form now edits either a queued row or
    // "Now serving" (same drinks-table row, same validation) — refresh
    // both lists rather than branching on which one it was, since only
    // one of the two will actually contain a row with this id.
    updateDrink(editingQueuedId, trimmed, volumeMl)
      .then(() => {
        refreshQueuedDrinks()
        refreshCurrentDrink()
      })
      .catch((err) => console.error('Failed to edit drink', err))
    closeEditQueuedDrink()
  }

  // app/drink-switchback: switching back to any past drink from the
  // picker list — same underlying operation as promoting the queue
  // (switchToDrink demotes whatever's currently serving, re-queuing it
  // as "Up next" if it still has alcohol in it, per DECISIONS.md), just
  // aimed at a drink the user picked rather than the staged queue slot.
  function handleSwitchToPastDrink(drinkId) {
    if (!sessionId) return
    switchToDrink(sessionId, drinkId)
      .then(() => {
        refreshCurrentDrink()
        refreshQueuedDrinks()
        refreshDrinkHistory()
      })
      .catch((err) => console.error('Failed to switch back to drink', err))
    setSwitching(false)
  }

  // app/drink-queue-list: cancelling one queued row no longer touches the
  // others — `drinkId` is required since more than one row can be queued.
  function handleCancelQueuedDrink(drinkId) {
    if (!drinkId) return
    cancelQueuedDrink(drinkId)
      .then(refreshQueuedDrinks)
      .catch((err) => console.error('Failed to cancel queued drink', err))
    setConfirmDeleteId(null)
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

  // app/drink-switchback: which drink a POUR should be tagged against —
  // read via a ref inside onEvent for the same reason volumeIdRef is
  // (onEvent is set up once by useTurnManager and shouldn't be recreated
  // every time currentDrink changes).
  const currentDrinkIdRef = useRef(currentDrink?.id ?? null)
  currentDrinkIdRef.current = currentDrink?.id ?? null

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
      const drinkId = type === 'POUR' ? currentDrinkIdRef.current : null
      logEvent(sessionId, participant.id, type, volume, null, drinkId)
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

  // app/turn-timer: optional, mid-session-settable per-turn countdown —
  // the user's own framing was "make it look more intense", not a real
  // house rule, so this never calls onPass/onPourConfirmed itself (see
  // useTurnTimer's doc comment). `timerSeconds` is null (off) by default;
  // picking a preset from the control below turns it on. `timerPickerOpen`
  // is the little floating dropdown that preset list lives in — same
  // absolute-positioned, non-layout-shifting pattern already used for the
  // "+N more queued" dropdown, since a toggle like this shouldn't nudge
  // TurnRing around every time it's opened either.
  const [timerSeconds, setTimerSeconds] = useState(null)
  const [timerPickerOpen, setTimerPickerOpen] = useState(false)
  const { secondsLeft: timerSecondsLeft, expired: timerExpired } = useTurnTimer(
    currentIndex,
    timerSeconds,
  )

  // Buzzer fires exactly once per expiry, not once per render while
  // `timerExpired` stays true — `useTurnTimer` only flips `expired` to
  // true once per turn, so a plain effect on it already has that
  // guarantee without needing its own extra ref/flag here.
  useEffect(() => {
    if (timerExpired) playBuzzer()
  }, [timerExpired])

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
  // app/drink-queue-list (UX pass: long queues): one row's markup, pulled
  // out of the JSX below so it can be called once for the always-visible
  // oldest row and again, per item, for whatever's behind the "+N more
  // queued" toggle — same row, same handlers, just two call sites instead
  // of duplicated JSX.
  function renderQueuedRow(drink, index) {
    const isNext = drink.id === nextQueuedDrink?.id
    const urgent = isNext && isEmpty
    // app/drink-queue-list (fix: every row said "Up next"): only the
    // oldest-staged row actually is "up next" — later rows are further
    // back in line, so they get their queue position instead of
    // repeating the same label on every row.
    const queueLabel = urgent
      ? `${currentDrink.name} is empty — switch to?`
      : isNext
        ? 'Up next'
        : `#${index + 1} in queue`
    const queuedRemaining = remainingForDrink(drink)
    const isEditing = editingQueuedId === drink.id
    const isConfirmingDelete = confirmDeleteId === drink.id

    if (isEditing) {
      return (
        <form
          key={drink.id}
          onSubmit={handleEditQueuedSubmit}
          className="flex w-full flex-wrap items-center gap-2 rounded-xl bg-smoke/60 px-3 py-2.5 text-sm ring-1 ring-smoke-light"
        >
          <input
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            placeholder="Drink name"
            autoFocus
            className="min-w-0 flex-1 rounded-xl bg-ink px-3 py-2 text-paper placeholder-paper-dim/60 outline-none ring-1 ring-smoke-light focus:ring-2 focus:ring-ember"
          />
          <VolumeInput
            amount={editVolumeInput}
            unit={editVolumeUnit}
            onAmountChange={setEditVolumeInput}
            onUnitChange={setEditVolumeUnit}
            idPrefix={`edit-queued-${drink.id}`}
          />
          <button
            type="submit"
            disabled={!editName.trim() || editVolumeMissing}
            className="rounded-full bg-ember px-3 py-1.5 text-xs font-semibold text-ink transition active:scale-95 disabled:opacity-40"
          >
            Save
          </button>
          <button
            type="button"
            onClick={closeEditQueuedDrink}
            className="rounded-full px-3 py-1.5 text-xs font-medium text-paper-dim transition hover:text-paper"
          >
            Cancel
          </button>
          {editVolumeMissing && (
            <p className="w-full px-1 text-xs text-maroon-dim">
              Add a volume, or clear the name.
            </p>
          )}
        </form>
      )
    }

    return (
      <div
        key={drink.id}
        className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ring-1 transition ${
          urgent
            ? 'bg-maroon/15 ring-maroon/40'
            : 'bg-smoke/60 ring-smoke-light'
        }`}
      >
        <div className="min-w-0 flex-1">
          <p className={`truncate text-xs font-medium ${urgent ? 'text-maroon-dim' : 'text-paper-dim'}`}>
            {queueLabel}
          </p>
          <p className="truncate text-sm text-paper">
            {drink.name}
            {queuedRemaining != null && (
              <span className="text-paper-dim"> · {queuedRemaining}mL left</span>
            )}
          </p>
        </div>

        {isConfirmingDelete ? (
          <div className="flex shrink-0 items-center gap-1.5">
            <span className="text-xs font-medium text-maroon-dim">Delete?</span>
            <button
              type="button"
              onClick={() => handleCancelQueuedDrink(drink.id)}
              className="rounded-full bg-maroon px-2.5 py-1 text-xs font-semibold text-paper transition active:scale-95"
            >
              Yes
            </button>
            <button
              type="button"
              onClick={disarmDeleteQueuedDrink}
              className="rounded-full px-2.5 py-1 text-xs font-medium text-paper-dim transition hover:text-paper"
            >
              No
            </button>
          </div>
        ) : (
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => handlePromoteQueuedDrink(drink.id)}
              aria-label={`Switch now to ${drink.name}`}
              title="Switch now"
              className={`flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-semibold transition active:scale-95 ${
                urgent
                  ? 'bg-maroon text-paper'
                  : 'bg-smoke-light text-paper hover:bg-ember hover:text-ink'
              }`}
            >
              <SwitchIcon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Switch</span>
            </button>
            <button
              type="button"
              onClick={() => openEditQueuedDrink(drink)}
              aria-label={`Edit ${drink.name}`}
              title="Edit"
              className="rounded-full p-1.5 text-paper-dim/80 transition hover:bg-smoke-light hover:text-paper active:scale-95"
            >
              <EditIcon className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => armDeleteQueuedDrink(drink.id)}
              aria-label={`Delete ${drink.name}`}
              title="Delete"
              className="rounded-full p-1.5 text-paper-dim/80 transition hover:bg-maroon/20 hover:text-maroon-dim active:scale-95"
            >
              <TrashIcon className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    )
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
                {/* app/drink-edit-current: fixes a typo'd name or a
                    mistyped mL on "Now serving" without having to switch
                    away and back. Same inline form, same editingQueuedId/
                    editName state and the same "volume required once a
                    name is given" validation as an "Up next" row's edit
                    — just targeting currentDrink.id instead of a queued
                    row's id. */}
                {editingQueuedId === currentDrink.id ? (
                  <form
                    onSubmit={handleEditQueuedSubmit}
                    className="flex flex-wrap items-center justify-center gap-2 text-sm"
                  >
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder="Drink name"
                      autoFocus
                      className="min-w-0 flex-1 rounded-xl bg-ink px-3 py-2 text-paper placeholder-paper-dim/60 outline-none ring-1 ring-smoke-light focus:ring-2 focus:ring-ember"
                    />
                    <VolumeInput
                      amount={editVolumeInput}
                      unit={editVolumeUnit}
                      onAmountChange={setEditVolumeInput}
                      onUnitChange={setEditVolumeUnit}
                      idPrefix="edit-current-drink"
                    />
                    <button
                      type="submit"
                      disabled={!editName.trim() || editVolumeMissing}
                      className="rounded-full bg-ember px-3 py-1.5 text-xs font-semibold text-ink transition active:scale-95 disabled:opacity-40"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={closeEditQueuedDrink}
                      className="rounded-full px-3 py-1.5 text-xs font-medium text-paper-dim transition hover:text-paper"
                    >
                      Cancel
                    </button>
                    {editVolumeMissing && (
                      <p className="w-full px-1 text-center text-xs text-maroon-dim">
                        Add a volume, or clear the name.
                      </p>
                    )}
                  </form>
                ) : (
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
                      onClick={() => openEditQueuedDrink(currentDrink)}
                      aria-label={`Edit ${currentDrink.name}`}
                      title="Edit"
                      className="rounded-full p-1.5 text-paper-dim/80 transition hover:bg-smoke-light hover:text-paper active:scale-95"
                    >
                      <EditIcon className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => (switching ? setSwitching(false) : openSwitchDifferentDrink())}
                      aria-label="Switch drink now or queue a different drink for later"
                      className="rounded-full bg-smoke-light px-2.5 py-1 text-xs font-medium text-paper transition hover:bg-ember hover:text-ink active:scale-95"
                    >
                      Switch / Queue
                    </button>
                  </div>
                )}
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

              {/* app/drink-queue (+ app/drink-queue-list, UX pass):
                  "Up next" — a real multi-item queue, oldest-staged first
                  (getQueuedDrinks orders by started_at ASC), each row
                  independently switchable, editable, and deletable.
                  Rebuilt from flex-wrapped pills into proper stacked cards
                  (full-width rows, left-aligned text, icon buttons on the
                  right) — the pill styling read fine for one row but
                  became a cramped, centered wall of text and buttons once
                  several rows stacked up. Only the first row
                  (nextQueuedDrink) gets the urgent maroon "switch to?"
                  treatment once isEmpty — later rows stay quiet (smoke-
                  toned) since they aren't the immediate concern yet.
                  Delete is a two-tap confirm (armDeleteQueuedDrink /
                  confirmDeleteId) rather than instant, since there's no
                  undo for it; everything else stays a single tap, inline,
                  never a popup (see DECISIONS.md). Edit swaps a row into
                  a form in place instead of opening a dialog. */}
              {queuedDrinks.length > 0 && (
                <div className="relative w-full space-y-2">
                  {renderQueuedRow(queuedDrinks[0], 0)}

                  {queuedDrinks.length > 1 && (
                    <>
                      {/* app/drink-queue-list (UX pass: long queues, then
                          UX pass: floating dropdown): collapsed by default
                          once there's more than one row — the
                          oldest-staged drink above is already the one
                          that matters most. The expanded list used to sit
                          inline, which pushed TurnRing (the turn-order
                          circle, rendered further down this same column)
                          down the page every time it opened — reported as
                          "the circle moves down" when tapping the toggle.
                          It's now an absolutely positioned dropdown
                          instead: anchored to this relative wrapper,
                          floating over whatever's below (`z-20`, `shadow-lg`)
                          rather than pushing it, so opening/closing it
                          never changes anyone else's layout. Capped at
                          `max-h-64` + scroll as a safety net for a queue
                          long enough that even the dropdown would run off
                          the bottom of the screen. */}
                      <button
                        type="button"
                        onClick={() => setQueueExpanded((v) => !v)}
                        className="flex w-full items-center justify-center gap-1 rounded-full py-1.5 text-xs font-medium text-paper-dim transition hover:text-paper"
                      >
                        {queueExpanded
                          ? 'Hide'
                          : `+${queuedDrinks.length - 1} more queued`}
                        <span
                          className={`inline-block transition-transform ${queueExpanded ? 'rotate-180' : ''}`}
                        >
                          ▾
                        </span>
                      </button>
                      {queueExpanded && (
                        <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-64 space-y-2 overflow-y-auto rounded-xl bg-smoke p-2 ring-1 ring-smoke-light shadow-lg">
                          {queuedDrinks.slice(1).map((drink, i) => renderQueuedRow(drink, i + 1))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

            </div>
          )}

          {/* app/drink-queue (UX pass: dialog + animation): the "switch
              now" / "queue next" forms used to be an inline-expanding
              section. Rebuilt as a proper modal dialog — bottom sheet on
              phone-width screens, centered on larger ones (same responsive
              convention ParticipantManagerSheet already uses), with a
              smooth fade+scale/slide transition in both directions.
              Deliberately always mounted (never `{switching && (...)}`) —
              that's what makes the *closing* transition possible at all;
              an unmounted element can't animate out. Visibility is driven
              entirely by the `switching` boolean toggling classes instead,
              the same technique this screen's exit-confirm bar already
              uses. `inert` (not manual tabIndex/aria-hidden per field)
              keeps every input unreachable by keyboard/screen reader while
              closed, in one line, covering VolumeInput's internal controls
              too without threading a prop through it. Backdrop click and
              the header's Done button both close it. */}
          {currentDrink && (
            <div
              className={`fixed inset-0 z-20 flex items-end justify-center bg-ink/70 p-4 backdrop-blur-sm transition-opacity duration-300 ease-out sm:items-center ${
                switching ? 'opacity-100' : 'pointer-events-none opacity-0'
              }`}
              inert={!switching}
              onClick={() => setSwitching(false)}
            >
              <div
                onClick={(e) => e.stopPropagation()}
                className={`w-full max-w-md space-y-3 rounded-2xl bg-smoke p-5 ring-1 ring-smoke-light transition-all duration-300 ease-out ${
                  switching ? 'translate-y-0 scale-100 opacity-100' : 'translate-y-6 scale-95 opacity-0 sm:translate-y-0'
                }`}
              >
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-base font-semibold text-paper">Switch / Queue drink</h2>
                  <button
                    type="button"
                    onClick={() => setSwitching(false)}
                    className="rounded-full px-2 py-1 text-sm text-paper-dim transition hover:text-paper active:scale-95"
                  >
                    Done
                  </button>
                </div>

                <div className="space-y-2">
                  <p className="px-1 text-xs text-paper-dim">Ran out right now? Switch immediately.</p>
                  <button
                    type="button"
                    onClick={handleSwitchSameDrink}
                    className="w-full rounded-xl px-4 py-2 text-sm font-medium text-paper ring-1 ring-smoke-light transition hover:bg-smoke-light active:scale-95"
                  >
                    Same drink{currentDrink.volume_ml ? ` · ${currentDrink.volume_ml}mL` : ''} (new bottle)
                  </button>
                  <form onSubmit={handleSwitchSubmit} className="space-y-2">
                    <input
                      type="text"
                      value={switchName}
                      onChange={(e) => setSwitchName(e.target.value)}
                      placeholder="Different drink"
                      aria-label="Different drink name"
                      className="w-full rounded-xl bg-ink px-3 py-2 text-sm text-paper placeholder-paper-dim/60 outline-none ring-1 ring-smoke-light focus:ring-2 focus:ring-ember"
                    />
                    <div className="flex gap-2">
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
                        disabled={!switchName.trim() || switchVolumeMissing}
                        className="flex-1 rounded-xl bg-ember px-3 py-2 text-sm font-semibold text-ink transition active:scale-95 disabled:opacity-30"
                      >
                        Log
                      </button>
                    </div>
                    {switchVolumeMissing && (
                      <p className="px-1 text-xs text-maroon-dim">Add a volume, or clear the name.</p>
                    )}
                  </form>
                </div>

                {/* app/drink-queue: stage a drink ahead of time instead of
                    switching to it right now — doesn't touch currentDrink
                    at all, just shows up as "Up next" above until promoted
                    (one tap) or cancelled. */}
                <div className="space-y-2 border-t border-smoke-light pt-3">
                  <p className="px-1 text-xs text-paper-dim">
                    Not empty yet? Set up the next one for later.
                  </p>
                  <form onSubmit={handleQueueSubmit} className="space-y-2">
                    <input
                      type="text"
                      value={queueName}
                      onChange={(e) => setQueueName(e.target.value)}
                      placeholder="Next drink"
                      aria-label="Next drink name"
                      className="w-full rounded-xl bg-ink px-3 py-2 text-sm text-paper placeholder-paper-dim/60 outline-none ring-1 ring-smoke-light focus:ring-2 focus:ring-ember"
                    />
                    <div className="flex gap-2">
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
                        disabled={!queueName.trim() || queueVolumeMissing}
                        className="flex-1 rounded-xl px-3 py-2 text-sm font-semibold text-paper ring-1 ring-smoke-light transition hover:bg-smoke-light active:scale-95 disabled:opacity-30"
                      >
                        Queue
                      </button>
                    </div>
                    {queueVolumeMissing && (
                      <p className="px-1 text-xs text-maroon-dim">Add a volume, or clear the name.</p>
                    )}
                  </form>
                </div>

                                {/* app/drink-switchback: switch back to any past drink
                    and see how much was left and roughly how long ago that
                    was. Only the drink currently "Now serving" is left out
                    — queued ("Up next") drinks now have their own list
                    above (app/drink-queue-list), so they're no longer
                    duplicated into this picker. */}
                {pastDrinks.length > 0 && (
                  <div className="space-y-2 border-t border-smoke-light pt-3">
                    <p className="px-1 text-xs text-paper-dim">
                      Still some left in an earlier drink? Switch back to it.
                    </p>
                    <div className="max-h-40 space-y-1.5 overflow-y-auto">
                      {pastDrinks.map((d) => {
                        const remaining = remainingForDrink(d)
                        const empty = remaining != null && remaining <= 0
                        return (
                          <button
                            key={d.id}
                            type="button"
                            onClick={() => handleSwitchToPastDrink(d.id)}
                            className="flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-sm ring-1 ring-smoke-light transition hover:bg-smoke-light active:scale-95"
                          >
                            <span className="truncate text-paper">{d.name}</span>
                            <span className={`shrink-0 text-xs ${empty ? 'text-maroon-dim' : 'text-paper-dim'}`}>
                              {remaining != null ? `${remaining}mL left` : 'no volume logged'}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
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

          {/* app/turn-timer: the mid-session on/off + duration control,
              right next to what it's actually timing. A relative wrapper
              + absolute dropdown (not an inline-expanding list) so
              opening it never nudges TurnRing or anything else around it —
              same reasoning as the queue's own floating dropdown. Picking
              a preset both sets the duration and turns the timer on in
              one tap; "Off" is its own option rather than a separate
              toggle, since there's nothing else to configure once it's
              off. */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setTimerPickerOpen((v) => !v)}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ring-1 transition active:scale-95 ${
                timerExpired
                  ? 'bg-maroon text-paper ring-maroon/40'
                  : timerSeconds != null
                    ? 'bg-smoke-light text-paper ring-smoke-light'
                    : 'bg-smoke text-paper-dim ring-smoke-light hover:text-paper'
              }`}
            >
              <TimerIcon className="h-3.5 w-3.5" />
              {timerExpired
                ? "Time's up!"
                : timerSeconds != null
                  ? `${timerSecondsLeft}s`
                  : 'Turn timer: Off'}
            </button>
            {timerPickerOpen && (
              <div className="absolute left-1/2 top-full z-20 mt-1 flex -translate-x-1/2 items-center gap-1 rounded-full bg-smoke p-1 ring-1 ring-smoke-light shadow-lg">
                {[10, 15, 30, 60].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => {
                      setTimerSeconds(s)
                      setTimerPickerOpen(false)
                    }}
                    className={`rounded-full px-2.5 py-1 text-xs font-medium transition active:scale-95 ${
                      timerSeconds === s
                        ? 'bg-ember text-ink'
                        : 'text-paper-dim hover:bg-smoke-light hover:text-paper'
                    }`}
                  >
                    {s}s
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    setTimerSeconds(null)
                    setTimerPickerOpen(false)
                  }}
                  className={`rounded-full px-2.5 py-1 text-xs font-medium transition active:scale-95 ${
                    timerSeconds == null
                      ? 'bg-smoke-light text-paper'
                      : 'text-paper-dim hover:bg-smoke-light hover:text-paper'
                  }`}
                >
                  Off
                </button>
              </div>
            )}
          </div>

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
          drinks={allDrinksForLog}
        />
      </div>
    </div>
  )
}
