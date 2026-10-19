import { useEffect, useState } from 'react'
import { AppSplash } from './shared/components/AppSplash'
import { ParticipantList } from './features/session/ParticipantList'
import { ActiveSessionScreen } from './features/session/ActiveSessionScreen'
import { HistoryScreen } from './features/history/HistoryScreen'
import { PeopleScreen } from './features/session/PeopleScreen'
import { useParticipants } from './features/session/useParticipants'
import { initDatabase } from './features/storage/db'
import { createSession, endSession, resumeSession, getSessionForResume } from './features/storage/sessionQueries'
import { findOrCreatePerson } from './features/storage/peopleQueries'
import { ensureAnonymousSession } from './features/sync/auth'
import { runSync } from './features/sync/syncJob'

function App() {
  const {
    participants,
    addParticipant,
    removeParticipant,
    renameParticipant,
    clearParticipants,
    moveParticipant,
    reorderParticipants,
    loadParticipants,
  } = useParticipants()
  const [screen, setScreen] = useState('participants') // 'participants' | 'session' | 'history' | 'people'

  // UX fix: screen switches are local-state only (no router/page nav — see
  // doc/TASKS.md's Backlog "Real browser back/forward support" for the
  // known, deliberate limitation that comes with that), so the browser
  // never resets scroll position on its own the way a real page nav would.
  // Without this, starting a session while scrolled down the participant
  // list left the active session screen scrolled to that same offset,
  // hiding its header until the person scrolled back up themselves.
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [screen])
  const [sessionId, setSessionId] = useState(null)
  const [sessionName, setSessionName] = useState('')
  const [passLimit, setPassLimit] = useState(null)
  const [starting, setStarting] = useState(false)

  // Schema setup (app/sqlite-schema) — dev-visible check that the connection +
  // schema actually came up; remove once enough real read/write UI exists to
  // verify it implicitly.
  const [dbStatus, setDbStatus] = useState('loading')

  useEffect(() => {
    initDatabase()
      .then(() => setDbStatus('ready'))
      .catch((err) => {
        console.error('Database init failed', err)
        setDbStatus('error')
      })
  }, [])

  // app/animated-splash: shown until initDatabase above settles (ready
  // or error -- either way there's nothing left to wait on; a failed db
  // isn't recoverable by waiting longer) AND at least MIN_SPLASH_MS has
  // elapsed, whichever is later. The minimum exists so a fast local
  // SQLite init (the common case) doesn't hide the splash
  // before the pour finishes -- the reveal runs ~2.55s (see AppSplash.jsx
  // and the .splash-* rules in index.css) and needs to complete to read as
  // a deliberate splash rather than a flash. Auth (below) is deliberately NOT part of
  // this condition: it's non-blocking everywhere else in this app (see
  // its own comment), so the splash shouldn't block on it either.
  const MIN_SPLASH_MS = 2600
  const [minSplashElapsed, setMinSplashElapsed] = useState(false)
  const [splashFading, setSplashFading] = useState(false)
  const [showSplash, setShowSplash] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => setMinSplashElapsed(true), MIN_SPLASH_MS)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (!showSplash || splashFading) return
    if (dbStatus === 'loading' || !minSplashElapsed) return
    setSplashFading(true)
    const timer = setTimeout(() => setShowSplash(false), 320) // matches AppSplash's own 300ms fade
    return () => clearTimeout(timer)
  }, [dbStatus, minSplashElapsed, showSplash, splashFading])

  // Anonymous auth (backend/anonymous-auth) — gives this device a stable identity
  // for sync, with no login UI. Failing (or Supabase not configured) is not fatal:
  // the app keeps working fully offline either way, so this only ever logs/sets a
  // debug status, never blocks the session flow above.
  const [authStatus, setAuthStatus] = useState('loading')
  const [deviceId, setDeviceId] = useState(null)

  useEffect(() => {
    ensureAnonymousSession()
      .then((id) => {
        if (id) {
          setDeviceId(id)
          setAuthStatus('ready')
        } else {
          setAuthStatus('offline')
        }
      })
      .catch((err) => {
        console.error('Anonymous auth failed', err)
        setAuthStatus('error')
      })
  }, [])

  // Sync job (backend/sync-job) — pushes unsynced local rows to Supabase.
  // Only meaningful once both the local DB and an anonymous session are
  // ready; otherwise there's either nothing to read or no device_id to push
  // under. A failed/offline sync just leaves rows queued, so this never
  // blocks or breaks the local-first flow above.
  const [syncStatus, setSyncStatus] = useState('idle')

  async function triggerSync() {
    setSyncStatus('syncing')
    const result = await runSync()
    if (result.ok) {
      setSyncStatus('done')
    } else if (
      result.reason === 'not-configured' ||
      result.reason === 'not-signed-in' ||
      result.reason === 'offline'
    ) {
      setSyncStatus('offline')
    } else {
      setSyncStatus('error')
    }
  }

  useEffect(() => {
    if (dbStatus === 'ready' && authStatus === 'ready') {
      triggerSync()
    }
  }, [dbStatus, authStatus])

  // Reconnect handling (backend/sync-reconnect-test) — the browser/WebView's
  // 'online' event fires when connectivity comes back after being offline, which
  // is exactly the moment a queue of unsynced rows should get flushed without
  // waiting for the user to end a session or reload the app.
  useEffect(() => {
    function handleOnline() {
      if (dbStatus === 'ready' && authStatus === 'ready') {
        triggerSync()
      }
    }
    window.addEventListener('online', handleOnline)
    return () => window.removeEventListener('online', handleOnline)
  }, [dbStatus, authStatus])

  // app/people-roster: resolving each participant to a roster person
  // (reusing an existing one on an exact case-insensitive match, or
  // creating a new entry) happens right here, once, for the whole list —
  // not back when each name was typed/added to "Who's joining". Someone
  // added and then removed before Start session is clicked should never
  // have touched the roster at all; this is the one point where the list
  // is actually committed to, so it's the right point to commit to the
  // roster too.
  async function handleStartSession(name, sessionPassLimit, drinkName = '', drinkVolumeMl = null) {
    setStarting(true)
    try {
      const resolvedParticipants = await Promise.all(
        participants.map(async (p) => {
          if (p.personId) return p
          try {
            const personId = await findOrCreatePerson(p.firstName || p.name, p.lastName || '')
            return { ...p, personId }
          } catch (err) {
            console.error('Failed to resolve roster person, starting without one', err)
            return p
          }
        }),
      )
      const id = await createSession(resolvedParticipants, name, drinkName, drinkVolumeMl)
      setSessionId(id)
      setSessionName(name.trim())
      setPassLimit(sessionPassLimit)
      setScreen('session')
    } catch (err) {
      console.error('Failed to start session', err)
    } finally {
      setStarting(false)
    }
  }

  async function handleExitSession() {
    if (sessionId) {
      try {
        await endSession(sessionId)
      } catch (err) {
        console.error('Failed to mark session ended', err)
      }
    }
    setSessionId(null)
    setSessionName('')
    setPassLimit(null)
    setScreen('participants')
    // app/clear-after-session: also sidesteps a UNIQUE constraint crash —
    // the old roster's ids are already written into this session's DB
    // rows, so reusing them for a second session (Start session again
    // without retyping anyone) would collide on participants.id.
    clearParticipants()
    triggerSync() // session just ended — a natural moment to push it (backend/sync-job)
  }

  // app/history-resume: "un-ends" a past session and drops back into
  // ActiveSessionScreen for it, same destination handleStartSession
  // lands on. Reloads *that session's own* participants (same ids as its
  // DB rows, via loadParticipants) rather than trying to merge with
  // whatever's currently in the in-memory roster — those are two
  // different things that happen to share state, and mixing them would
  // either lose the resumed session's real roster or silently carry
  // someone from an unrelated half-filled "Who's joining" draft into it.
  // Pass limit was never persisted anywhere (sessions has no such column
  // — see DECISIONS.md), so a resumed session always comes back with no
  // limit set; there's no original value to restore.
  async function handleResumeSession(sessionIdToResume) {
    try {
      const { session, participants: rows } = await getSessionForResume(sessionIdToResume)
      if (!session) return
      await resumeSession(sessionIdToResume)
      loadParticipants(
        rows.map((row) => ({
          id: row.id,
          name: row.name,
          personId: row.person_id ?? null,
        })),
      )
      setSessionId(sessionIdToResume)
      setSessionName(session.name || '')
      setPassLimit(null)
      setScreen('session')
    } catch (err) {
      console.error('Failed to resume session', err)
    }
  }

  return (
    <>
      {showSplash && <AppSplash fading={splashFading} />}
      {/* UX fix: Session History used to be reachable only from the
          participants screen, so checking it mid-round meant going through
          Back (which — even with its own confirm — ends the session). Now
          Session History can be opened straight from an active session
          too: ActiveSessionScreen stays mounted (just hidden via CSS,
          never unmounted) while screen is 'history', so useTurnManager's
          in-memory turn order/pass-streak state — which has nowhere else
          to live — survives the trip and the session is exactly as it was
          when the person comes back. */}
      {sessionId && (
        <div className={screen === 'history' ? 'hidden' : undefined}>
          <ActiveSessionScreen
            participants={participants}
            sessionId={sessionId}
            sessionName={sessionName}
            passLimit={passLimit}
            onExit={handleExitSession}
            onViewHistory={() => setScreen('history')}
            onRenameParticipant={renameParticipant}
            onAddParticipant={addParticipant}
          />
        </div>
      )}
      {screen === 'history' && (
        <HistoryScreen
          onExit={() => setScreen(sessionId ? 'session' : 'participants')}
          onResume={handleResumeSession}
        />
      )}
      {/* app/people-roster: only reachable from the participants screen (not
          mid-session, unlike History) - there's no in-session reason to
          browse the whole roster, and ActiveSessionScreen's own "Manage
          participants" sheet already covers renaming *this session's*
          people. */}
      {screen === 'people' && <PeopleScreen onBack={() => setScreen('participants')} />}
      {!sessionId && screen === 'participants' && (
        <ParticipantList
          participants={participants}
          onAdd={addParticipant}
          onRename={renameParticipant}
          dbReady={dbStatus === 'ready'}
          onRemove={removeParticipant}
          onMoveUp={(id) => moveParticipant(id, -1)}
          onMoveDown={(id) => moveParticipant(id, 1)}
          onReorder={reorderParticipants}
          onStartSession={handleStartSession}
          startingSession={starting}
          onViewHistory={() => setScreen('history')}
          onViewPeople={() => setScreen('people')}
        />
      )}
      <div className="fixed bottom-2 right-2 flex flex-col items-end gap-1 text-[10px]">
        <div
          className={`rounded-full px-2 py-1 ring-1 ${
            authStatus === 'ready'
              ? 'bg-bamboo/15 text-bamboo-dim ring-bamboo/40'
              : authStatus === 'error'
                ? 'bg-maroon/15 text-maroon-dim ring-maroon/40'
                : 'bg-smoke text-paper-dim ring-smoke-light'
          }`}
        >
          auth: {authStatus}
          {deviceId ? ` (${deviceId.slice(0, 8)})` : ''}
        </div>
        <div
          className={`rounded-full px-2 py-1 ring-1 ${
            dbStatus === 'ready'
              ? 'bg-bamboo/15 text-bamboo-dim ring-bamboo/40'
              : dbStatus === 'error'
                ? 'bg-maroon/15 text-maroon-dim ring-maroon/40'
                : 'bg-smoke text-paper-dim ring-smoke-light'
          }`}
        >
          db: {dbStatus}
        </div>
        <div
          className={`rounded-full px-2 py-1 ring-1 ${
            syncStatus === 'done'
              ? 'bg-bamboo/15 text-bamboo-dim ring-bamboo/40'
              : syncStatus === 'error'
                ? 'bg-maroon/15 text-maroon-dim ring-maroon/40'
                : 'bg-smoke text-paper-dim ring-smoke-light'
          }`}
        >
          sync: {syncStatus}
        </div>
      </div>
    </>
  )
}

export default App
