import { useEffect, useState } from 'react'
import { ParticipantList } from './features/session/ParticipantList'
import { ActiveSessionScreen } from './features/session/ActiveSessionScreen'
import { HistoryScreen } from './features/history/HistoryScreen'
import { useParticipants } from './features/session/useParticipants'
import { initDatabase } from './features/storage/db'
import { createSession, endSession } from './features/storage/sessionQueries'
import { ensureAnonymousSession } from './features/sync/auth'
import { runSync } from './features/sync/syncJob'

function App() {
  const { participants, addParticipant, removeParticipant, moveParticipant } =
    useParticipants()
  const [screen, setScreen] = useState('participants') // 'participants' | 'session' | 'history'
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

  async function handleStartSession(name, sessionPassLimit) {
    setStarting(true)
    try {
      const id = await createSession(participants, name)
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
    triggerSync() // session just ended — a natural moment to push it (backend/sync-job)
  }

  return (
    <>
      {screen === 'session' && (
        <ActiveSessionScreen
          participants={participants}
          sessionId={sessionId}
          sessionName={sessionName}
          passLimit={passLimit}
          onExit={handleExitSession}
        />
      )}
      {screen === 'history' && <HistoryScreen onExit={() => setScreen('participants')} />}
      {screen === 'participants' && (
        <ParticipantList
          participants={participants}
          onAdd={addParticipant}
          onRemove={removeParticipant}
          onMoveUp={(id) => moveParticipant(id, -1)}
          onMoveDown={(id) => moveParticipant(id, 1)}
          onStartSession={handleStartSession}
          startingSession={starting}
          onViewHistory={() => setScreen('history')}
        />
      )}
      <div className="fixed bottom-2 right-2 flex flex-col items-end gap-1 font-mono text-[10px]">
        <div
          className={`rounded px-2 py-1 ${
            authStatus === 'ready'
              ? 'bg-emerald-950 text-emerald-400'
              : authStatus === 'error'
                ? 'bg-red-950 text-red-400'
                : 'bg-neutral-900 text-neutral-500'
          }`}
        >
          auth: {authStatus}
          {deviceId ? ` (${deviceId.slice(0, 8)})` : ''}
        </div>
        <div
          className={`rounded px-2 py-1 ${
            dbStatus === 'ready'
              ? 'bg-emerald-950 text-emerald-400'
              : dbStatus === 'error'
                ? 'bg-red-950 text-red-400'
                : 'bg-neutral-900 text-neutral-500'
          }`}
        >
          db: {dbStatus}
        </div>
        <div
          className={`rounded px-2 py-1 ${
            syncStatus === 'done'
              ? 'bg-emerald-950 text-emerald-400'
              : syncStatus === 'error'
                ? 'bg-red-950 text-red-400'
                : 'bg-neutral-900 text-neutral-500'
          }`}
        >
          sync: {syncStatus}
        </div>
      </div>
    </>
  )
}

export default App
