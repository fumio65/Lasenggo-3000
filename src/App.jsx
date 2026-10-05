import { useEffect, useState } from 'react'
import { ParticipantList } from './features/session/ParticipantList'
import { ActiveSessionScreen } from './features/session/ActiveSessionScreen'
import { useParticipants } from './features/session/useParticipants'
import { initDatabase } from './features/storage/db'

function App() {
  const { participants, addParticipant, removeParticipant, moveParticipant } =
    useParticipants()
  const [screen, setScreen] = useState('participants') // 'participants' | 'session'

  // Schema setup only (app/sqlite-schema) — nothing reads/writes rows yet,
  // that's app/local-event-logging. dbStatus is a temporary dev-visible
  // check that the connection + schema actually came up; remove once real
  // read/write UI exists to verify it implicitly.
  const [dbStatus, setDbStatus] = useState('loading')

  useEffect(() => {
    initDatabase()
      .then(() => setDbStatus('ready'))
      .catch((err) => {
        console.error('Database init failed', err)
        setDbStatus('error')
      })
  }, [])

  return (
    <>
      {screen === 'session' ? (
        <ActiveSessionScreen
          participants={participants}
          onExit={() => setScreen('participants')}
        />
      ) : (
        <ParticipantList
          participants={participants}
          onAdd={addParticipant}
          onRemove={removeParticipant}
          onMoveUp={(id) => moveParticipant(id, -1)}
          onMoveDown={(id) => moveParticipant(id, 1)}
          onStartSession={() => setScreen('session')}
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
