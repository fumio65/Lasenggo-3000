import { useEffect, useRef, useState } from 'react'
import { BackIcon } from '../../shared/components/BackIcon'
import { PeopleIcon } from '../../shared/components/PeopleIcon'
import { deletePerson, getPeople, renamePerson } from '../storage/peopleQueries'

/**
 * Roster management screen (app/people-roster) — everyone who's ever been
 * typed into "Who's joining", most-recently-used first, with inline rename
 * and delete. Deliberately no "Add" control here: a new person only ever
 * enters the roster organically, by being typed (and autocompleted or not)
 * into the name field at session start — this screen is for tidying up
 * what's already there (a typo, someone who isn't coming around anymore),
 * not for pre-populating it.
 *
 * Renaming here only changes the roster's own name going forward (future
 * suggestions, future sessions) — it never rewrites a past session's own
 * participant name copy, same separation HistoryDetail already relies on
 * for a participant renamed mid-session.
 */
export function PeopleScreen({ onBack }) {
  const [people, setPeople] = useState([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState(null)
  const [editValue, setEditValue] = useState('')
  const editInputRef = useRef(null)

  useEffect(() => {
    getPeople()
      .then(setPeople)
      .catch((err) => console.error('Failed to load people roster', err))
      .finally(() => setLoading(false))
  }, [])

  function startEdit(person) {
    setEditingId(person.id)
    setEditValue(person.name)
  }

  async function saveEdit() {
    const id = editingId
    const trimmed = editValue.trim()
    setEditingId(null)
    if (!id || !trimmed) return
    try {
      await renamePerson(id, trimmed)
      setPeople((prev) => prev.map((p) => (p.id === id ? { ...p, name: trimmed } : p)))
    } catch (err) {
      console.error('Failed to rename person', err)
    }
  }

  async function handleDelete(id) {
    try {
      await deletePerson(id)
      setPeople((prev) => prev.filter((p) => p.id !== id))
    } catch (err) {
      console.error('Failed to delete person', err)
    }
  }

  return (
    <div className="min-h-screen bg-ink px-6 py-10 text-paper">
      <div className="mx-auto max-w-md space-y-6">
        <header className="space-y-3">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1.5 rounded-full bg-smoke px-3 py-1.5 text-sm text-paper-dim ring-1 ring-smoke-light transition hover:bg-smoke-light hover:text-paper active:scale-95"
          >
            <BackIcon /> Back
          </button>
          <h1 className="font-display text-2xl font-semibold tracking-tight">People</h1>
          <p className="text-sm text-paper-dim">
            Everyone who's shown up before — tap a name to fix a typo, or remove someone who
            isn't coming around. New names join this list on their own the next time you type
            one in "Who's joining".
          </p>
        </header>

        {loading ? (
          <ul className="space-y-2" aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <li key={i} className="h-12 animate-pulse rounded-xl bg-smoke" />
            ))}
          </ul>
        ) : people.length === 0 ? (
          <div className="rounded-xl border border-dashed border-smoke-light px-4 py-8 text-center text-sm text-paper-dim">
            <PeopleIcon className="mx-auto mb-2 h-5 w-5 opacity-40" />
            No one yet. Names you add to a session show up here automatically.
          </div>
        ) : (
          <ul className="space-y-2">
            {people.map((person) => {
              const isEditing = editingId === person.id
              return (
                <li
                  key={person.id}
                  className="flex items-center gap-2 rounded-xl bg-smoke px-3 py-2.5 ring-1 ring-smoke-light"
                >
                  {isEditing ? (
                    <input
                      ref={editInputRef}
                      autoFocus
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveEdit()
                        if (e.key === 'Escape') setEditingId(null)
                      }}
                      onBlur={saveEdit}
                      className="min-w-0 flex-1 rounded-lg bg-ink px-2 py-1 text-sm text-paper outline-none ring-1 ring-ember"
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => startEdit(person)}
                      className="min-w-0 flex-1 truncate text-left text-sm text-paper transition hover:text-ember"
                      title="Edit name"
                    >
                      {person.name}
                    </button>
                  )}
                  {!isEditing && (
                    <button
                      type="button"
                      onClick={() => handleDelete(person.id)}
                      aria-label={`Remove ${person.name} from the roster`}
                      className="shrink-0 rounded-lg px-2.5 py-1.5 text-maroon-dim transition hover:bg-maroon/20 active:scale-90"
                    >
                      ✕
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
