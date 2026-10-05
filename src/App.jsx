import { useState } from 'react'
import { ParticipantList } from './features/session/ParticipantList'
import { ActiveSessionScreen } from './features/session/ActiveSessionScreen'
import { useParticipants } from './features/session/useParticipants'

function App() {
  const { participants, addParticipant, removeParticipant, moveParticipant } =
    useParticipants()
  const [screen, setScreen] = useState('participants') // 'participants' | 'session'

  if (screen === 'session') {
    return (
      <ActiveSessionScreen
        participants={participants}
        onExit={() => setScreen('participants')}
      />
    )
  }

  return (
    <ParticipantList
      participants={participants}
      onAdd={addParticipant}
      onRemove={removeParticipant}
      onMoveUp={(id) => moveParticipant(id, -1)}
      onMoveDown={(id) => moveParticipant(id, 1)}
      onStartSession={() => setScreen('session')}
    />
  )
}

export default App
