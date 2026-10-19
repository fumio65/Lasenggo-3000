import { getDatabase } from './db'
import { supabase } from '../sync/supabaseClient'

/**
 * app/saved-drinks: read/write helpers for `saved_drinks`, the remembered
 * drinks list behind tap-to-fill (DrinkNameInput) and the Drinks screen.
 * Mirrors peopleQueries.js: entries appear on their own when a drink is
 * logged, most recently used first, and deletes leave a tombstone so a
 * sync pull can't bring them back.
 */

/** All saved drinks, most recently used first. */
export async function getSavedDrinks() {
  const db = getDatabase()
  const result = await db.query(
    'SELECT id, name, volume_ml, last_used_at FROM saved_drinks ORDER BY last_used_at DESC',
  )
  return result.values ?? []
}

/**
 * Remembers a drink that was just logged: bumps `last_used_at` on an exact
 * match (same name ignoring case, same size), otherwise adds a new entry.
 * Called from sessionQueries wherever a drink row is written, so every way
 * of entering a drink feeds the list. Never throws: a failure here must not
 * break logging the drink itself.
 */
export async function recordSavedDrink(name, volumeMl) {
  const trimmed = (name || '').trim()
  if (!trimmed) return
  try {
    const db = getDatabase()
    const now = new Date().toISOString()
    const existing = await db.query(
      'SELECT id FROM saved_drinks WHERE name = ? COLLATE NOCASE AND volume_ml IS ?',
      [trimmed, volumeMl ?? null],
    )
    const match = existing.values?.[0]
    if (match) {
      await db.run('UPDATE saved_drinks SET last_used_at = ? WHERE id = ?', [now, match.id], false)
      return
    }
    await db.run(
      'INSERT INTO saved_drinks (id, name, volume_ml, created_at, last_used_at, synced) VALUES (?, ?, ?, ?, ?, 0)',
      [crypto.randomUUID(), trimmed, volumeMl ?? null, now, now],
      false,
    )
  } catch (err) {
    console.error('Failed to remember drink', err)
  }
}

/** Edits a saved drink's name and size. Marks it unsynced so the change is
 * pushed (an already-synced row is upserted by id). */
export async function updateSavedDrink(id, name, volumeMl) {
  const db = getDatabase()
  await db.run(
    'UPDATE saved_drinks SET name = ?, volume_ml = ?, synced = 0 WHERE id = ?',
    [name.trim(), volumeMl ?? null, id],
    false,
  )
}

/** Removes a saved drink: tombstone first (works offline and stops a pull
 * from restoring it), then a best-effort delete of the Supabase row, same
 * approach as peopleQueries.deletePerson. */
export async function deleteSavedDrink(id) {
  const db = getDatabase()
  const now = new Date().toISOString()
  await db.run('DELETE FROM saved_drinks WHERE id = ?', [id], false)
  await db.run(
    'INSERT OR REPLACE INTO deleted_saved_drinks (id, deleted_at) VALUES (?, ?)',
    [id, now],
    false,
  )
  if (supabase) {
    try {
      await supabase.from('saved_drinks').delete().eq('id', id)
    } catch (err) {
      console.warn('Remote delete of saved drink failed; local tombstone still prevents it coming back', err)
    }
  }
}
