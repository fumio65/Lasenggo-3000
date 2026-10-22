import { useState } from 'react'
import { getSavedDrinks } from '../../features/storage/savedDrinkQueries'
import { formatVolumeMl } from '../../features/pour/volumeUnits'

/**
 * app/saved-drinks: a drink name field with tap-to-fill from saved drinks,
 * used everywhere a drink is entered (Start Session, and the live
 * session's start-tracking, switch, queue and edit forms). Same look and
 * keyboard behavior as the "Who's joining" name suggestions: focusing the
 * field lists saved drinks, most recently used first, filtered as you
 * type; tapping one calls `onPick(savedDrink)` so the parent can fill both
 * the name and the size.
 *
 * Loads the list on every focus rather than once on mount, so a drink
 * saved a moment ago in another form, or edited on the Drinks screen,
 * shows up without a reload. It's a small local query.
 *
 * `wrapperClassName` sizes the field within its row (the flex classes the
 * plain input used to carry); `className` styles the input itself.
 */
export function DrinkNameInput({
  value,
  onChange,
  onPick,
  id,
  placeholder,
  ariaLabel = 'Drink name',
  autoFocus = false,
  className = '',
  wrapperClassName = '',
}) {
  const [options, setOptions] = useState([])
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(-1)
  const listId = `${id || 'drink-name'}-saved-drinks`

  function load() {
    getSavedDrinks()
      .then(setOptions)
      .catch(() => {}) // DB not ready yet, or failed: just no suggestions
  }

  const query = value.trim().toLowerCase()
  const filtered = (query ? options.filter((d) => d.name.toLowerCase().includes(query)) : options).slice(0, 6)
  const showList = open && filtered.length > 0

  function pick(drink) {
    onPick(drink)
    setOpen(false)
    setHighlight(-1)
  }

  function handleKeyDown(e) {
    if (!showList) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlight((i) => (i + 1) % filtered.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight((i) => (i <= 0 ? filtered.length - 1 : i - 1))
    } else if (e.key === 'Enter' && highlight >= 0) {
      e.preventDefault()
      pick(filtered[highlight])
    } else if (e.key === 'Escape') {
      setOpen(false)
      setHighlight(-1)
    }
  }

  return (
    <div className={`relative ${wrapperClassName}`}>
      <input
        id={id}
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value)
          setOpen(true)
          setHighlight(-1)
        }}
        onFocus={() => {
          load()
          setOpen(true)
        }}
        onBlur={() => setTimeout(() => setOpen(false), 100)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        aria-label={ariaLabel}
        autoFocus={autoFocus}
        autoComplete="off"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        className={`w-full ${className}`}
      />
      {showList && (
        <ul
          id={listId}
          role="listbox"
          className="absolute inset-x-0 top-full z-20 mt-1.5 overflow-hidden rounded-xl bg-smoke-light shadow-lg shadow-ink/50 ring-1 ring-smoke-light"
        >
          {filtered.map((drink, i) => (
            <li key={drink.id} role="option" aria-selected={i === highlight}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(drink)}
                className={`flex w-full items-center justify-between gap-3 px-4 py-2 text-left text-sm transition ${
                  i === highlight ? 'bg-ember/20 text-paper' : 'text-paper-dim hover:bg-ink/40 hover:text-paper'
                }`}
              >
                <span className="min-w-0 break-words">{drink.name}</span>
                {drink.volume_ml != null && (
                  <span className="shrink-0 text-xs tabular-nums text-paper-dim/80">
                    {formatVolumeMl(drink.volume_ml)}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
