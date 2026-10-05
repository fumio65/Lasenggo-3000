import { useState } from 'react'

function ParticipantRow({ participant, index, total, onRemove, onMoveUp, onMoveDown }) {
  return (
    <li className="flex items-center gap-3 rounded-lg bg-neutral-900 px-4 py-3">
      <span className="w-6 text-sm text-neutral-500">{index + 1}</span>
      <span className="flex-1 truncate text-neutral-100">{participant.name}</span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onMoveUp}
          disabled={index === 0}
          aria-label={`Move ${participant.name} up`}
          className="rounded px-2 py-1 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100 disabled:opacity-30 disabled:hover:bg-transparent"
        >
          ↑
        </button>
        <button
          type="button"
          onClick={onMoveDown}
          disabled={index === total - 1}
          aria-label={`Move ${participant.name} down`}
          className="rounded px-2 py-1 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100 disabled:opacity-30 disabled:hover:bg-transparent"
        >
          ↓
        </button>
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${participant.name}`}
          className="rounded px-2 py-1 text-red-400 hover:bg-red-950 hover:text-red-300"
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
 */
export function ParticipantList({
  participants,
  onAdd,
  onRemove,
  onMoveUp,
  onMoveDown,
  onStartSession,
}) {
  const [name, setName] = useState('')

  function handleSubmit(e) {
    e.preventDefault()
    onAdd(name)
    setName('')
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 p-6">
      <div className="mx-auto max-w-md space-y-6">
        <header className="space-y-1 text-center">
          <h1 className="text-2xl font-bold tracking-tight">Lasenggo 3000</h1>
          <p className="text-sm text-neutral-400">
            Add everyone joining this round before you start.
          </p>
        </header>

        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Participant name"
            className="flex-1 rounded-lg bg-neutral-900 px-4 py-2 text-neutral-100 placeholder-neutral-500 outline-none ring-1 ring-neutral-800 focus:ring-2 focus:ring-neutral-500"
          />
          <button
            type="submit"
            disabled={!name.trim()}
            className="rounded-lg bg-neutral-100 px-4 py-2 font-medium text-neutral-950 disabled:opacity-40"
          >
            Add
          </button>
        </form>

        {participants.length === 0 ? (
          <p className="rounded-lg border border-dashed border-neutral-800 px-4 py-8 text-center text-sm text-neutral-500">
            No one added yet. Add at least two people to start a session.
          </p>
        ) : (
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
              />
            ))}
          </ul>
        )}

        <button
          type="button"
          onClick={onStartSession}
          disabled={participants.length < 2}
          className="w-full rounded-lg bg-neutral-100 px-4 py-3 font-semibold text-neutral-950 disabled:opacity-30"
        >
          Start Session
        </button>
      </div>
    </div>
  )
}
