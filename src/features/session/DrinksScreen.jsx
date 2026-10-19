import { useEffect, useState } from 'react'
import { BackIcon } from '../../shared/components/BackIcon'
import { GlassIcon } from '../../shared/components/GlassIcon'
import { VolumeInput } from '../../shared/components/VolumeInput'
import { deleteSavedDrink, getSavedDrinks, updateSavedDrink } from '../storage/savedDrinkQueries'
import { formatVolumeMl, parseVolumeToMl, volumeMlToInput } from '../pour/volumeUnits'

/**
 * app/saved-drinks: the saved drinks list (the drinks counterpart of
 * PeopleScreen). No "Add" button on purpose: drinks join the list on their
 * own whenever one is logged at Start Session or mid-session. This screen
 * is for tidying up: fixing a typo or a wrong size, or removing one nobody
 * buys anymore. Edits only change future picks; past sessions keep the
 * name and size they were logged with.
 */
export function DrinksScreen({ onBack }) {
  const [drinks, setDrinks] = useState([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState(null)
  const [editName, setEditName] = useState('')
  const [editAmount, setEditAmount] = useState('')
  const [editUnit, setEditUnit] = useState('ml')
  const [confirmDrink, setConfirmDrink] = useState(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    getSavedDrinks()
      .then(setDrinks)
      .catch((err) => console.error('Failed to load saved drinks', err))
      .finally(() => setLoading(false))
  }, [])

  function startEdit(drink) {
    const v = volumeMlToInput(drink.volume_ml)
    setEditingId(drink.id)
    setEditName(drink.name)
    setEditAmount(v.amount)
    setEditUnit(v.unit)
  }

  const editVolumeMl = parseVolumeToMl(editAmount, editUnit)
  const canSave = editName.trim() !== '' && editVolumeMl != null

  async function saveEdit(e) {
    e.preventDefault()
    if (!canSave) return
    const id = editingId
    const name = editName.trim()
    try {
      await updateSavedDrink(id, name, editVolumeMl)
      setDrinks((prev) => prev.map((d) => (d.id === id ? { ...d, name, volume_ml: editVolumeMl } : d)))
      setEditingId(null)
    } catch (err) {
      console.error('Failed to update saved drink', err)
    }
  }

  async function handleConfirmDelete() {
    if (!confirmDrink) return
    setDeleting(true)
    try {
      await deleteSavedDrink(confirmDrink.id)
      setDrinks((prev) => prev.filter((d) => d.id !== confirmDrink.id))
      setConfirmDrink(null)
    } catch (err) {
      console.error('Failed to delete saved drink', err)
    } finally {
      setDeleting(false)
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
          <h1 className="font-display text-2xl font-semibold tracking-tight">Drinks</h1>
          <p className="text-sm text-paper-dim">
            Drinks you've poured before. Tap one to fix its name or size, or remove one you don't
            buy anymore. New drinks join this list on their own when you log them.
          </p>
        </header>

        {loading ? (
          <ul className="space-y-2" aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <li key={i} className="h-12 animate-pulse rounded-xl bg-smoke" />
            ))}
          </ul>
        ) : drinks.length === 0 ? (
          <div className="rounded-xl border border-dashed border-smoke-light px-4 py-8 text-center text-sm text-paper-dim">
            <GlassIcon className="mx-auto mb-2 h-5 w-5 opacity-40" />
            No drinks yet. Drinks you add to a session show up here automatically.
          </div>
        ) : (
          <ul className="space-y-2">
            {drinks.map((drink) =>
              editingId === drink.id ? (
                <li key={drink.id}>
                  <form
                    onSubmit={saveEdit}
                    className="space-y-2 rounded-xl bg-smoke px-3 py-2.5 ring-1 ring-ember/50"
                  >
                    <input
                      autoFocus
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Escape' && setEditingId(null)}
                      placeholder="Drink name"
                      aria-label="Drink name"
                      className="w-full rounded-lg bg-ink px-3 py-2 text-sm text-paper outline-none ring-1 ring-smoke-light focus:ring-2 focus:ring-ember"
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      <VolumeInput
                        idPrefix={`saved-drink-${drink.id}`}
                        label="Bottle size"
                        amount={editAmount}
                        unit={editUnit}
                        onAmountChange={setEditAmount}
                        onUnitChange={setEditUnit}
                      />
                      <div className="ml-auto flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="rounded-full px-3 py-1.5 text-xs font-medium text-paper-dim transition hover:text-paper"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={!canSave}
                          className="rounded-full bg-ember px-3 py-1.5 text-xs font-semibold text-ink transition active:scale-95 disabled:opacity-40"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  </form>
                </li>
              ) : (
                <li
                  key={drink.id}
                  className="flex items-center gap-2 rounded-xl bg-smoke px-3 py-2.5 ring-1 ring-smoke-light"
                >
                  <button
                    type="button"
                    onClick={() => startEdit(drink)}
                    className="flex min-w-0 flex-1 items-baseline justify-between gap-3 text-left text-sm text-paper transition hover:text-ember"
                    title="Edit drink"
                  >
                    <span className="min-w-0 break-words">{drink.name}</span>
                    {drink.volume_ml != null && (
                      <span className="shrink-0 text-xs tabular-nums text-paper-dim">
                        {formatVolumeMl(drink.volume_ml)}
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDrink(drink)}
                    aria-label={`Remove ${drink.name} from saved drinks`}
                    className="shrink-0 rounded-lg px-2.5 py-1.5 text-maroon-dim transition hover:bg-maroon/20 active:scale-90"
                  >
                    ✕
                  </button>
                </li>
              ),
            )}
          </ul>
        )}
      </div>

      {confirmDrink && (
        <div
          className="fixed inset-0 z-30 flex items-end justify-center bg-ink/70 p-4 backdrop-blur-sm sm:items-center"
          onClick={() => !deleting && setConfirmDrink(null)}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="remove-drink-title"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md space-y-3 rounded-2xl bg-smoke p-5 ring-1 ring-smoke-light"
          >
            <h2 id="remove-drink-title" className="font-display text-base font-semibold text-paper">
              Remove this drink?
            </h2>
            <p className="text-sm text-paper-dim">
              Removes{' '}
              <span className="text-paper">
                {confirmDrink.name}
                {confirmDrink.volume_ml != null ? ` (${formatVolumeMl(confirmDrink.volume_ml)})` : ''}
              </span>{' '}
              from your saved drinks. Past sessions keep their own record of it. It comes back the
              next time you log it.
            </p>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setConfirmDrink(null)}
                disabled={deleting}
                className="flex-1 rounded-xl px-3 py-2 text-sm font-semibold text-paper ring-1 ring-smoke-light transition hover:bg-smoke-light active:scale-95 disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={deleting}
                className="flex-1 rounded-xl bg-maroon px-3 py-2 text-sm font-semibold text-paper transition active:scale-95 disabled:opacity-40"
              >
                {deleting ? 'Removing…' : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
