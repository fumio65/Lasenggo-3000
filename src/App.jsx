import { useEffect, useState } from 'react'
import { ParticipantList } from './features/session/ParticipantList'
import { ActiveSessionScreen } from './features/session/ActiveSessionScreen'
import { useParticipants } from './features/session/useParticipants'
import { initDatabase } from './features/storage/db'
import { createSession, endSession } from './features/storage/sessionQueries'

function App() {
  const { participants, addParticipant, removeParticipant, moveParticipant } =
    useParticipants()
  const [screen, setScreen] = useState('participants') // 'participants' | 'session'
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
      {screen === 'session' ? (
        <ActiveSessionScreen
          participants={participants}
          sessionId={sessionId}
          onExit={handleExitSession}
        />
      ) : (
        <ParticipantList
          participants={participants}
          onAdd={addParticipant}
          onRemove={removeParticipant}
          onMoveUp={(id) => moveParticipant(id, -1)}
          onMoveDown={(id) => moveParticipant(id, 1)}
          onStartSession={handleStartSession}
          startingSession={starting}
        />
      )}
      <div
        className={`fixed bottom-2 right-2 rounded px-2 py-1 text-[10px] font-mono ${
          dbStatus === 'ready'
            ? 'bg-emerald-950 text-emerald-400'
            : dbStatus === 'error'
              ? 'bg-red-950 text-red-400'
              : 'bg-neutral-900 text-neutral-500'
        }`}
      >
        db: {dbStatus}
      </div>
    </>
  )
}

export default App
