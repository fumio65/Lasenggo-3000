import { useEffect, useState } from 'react'
import { ParticipantList } from './features/session/ParticipantList'
import { ActiveSessionScreen } from './features/session/ActiveSessionScreen'
import { HistoryScreen } from './features/history/HistoryScreen'
import { useParticipants } from './features/session/useParticipants'
import { initDatabase } from './features/storage/db'
import { createSession, endSession } from './features/storage/sessionQueries'
import { ensureAnonymousSession } from './features/sync/auth'

function App() {
  const { participants, addParticipant, removeParticipant, moveParticipant } =
    useParticipants()
  const [screen, setScreen] = useState('participants') // 'participants' | 'session' | 'history'
  const [sessionId, setSessionId] = useState(null)
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

  async function handleStartSession() {
    setStarting(true)
    try {
      const id = await createSession(participants)
      setSessionId(id)
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
    setScreen('participants')
  }

  return (
    <>
      {screen === 'session' && (
        <ActiveSessionScreen
          participants={participants}
          sessionId={sessionId}
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
      </div>
    </>
  )
}

export default App
