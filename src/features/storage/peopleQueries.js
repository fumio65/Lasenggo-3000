import { getDatabase } from './db'

/**
 * Read/write helpers for the `people` roster (app/people-roster) — a
 * recurring "who comes to tagayan" list, separate from a session's own
 * `participants` rows. Backs two things: the name-autocomplete on
 * ParticipantList's "Who's joining" field, and the roster management
 * screen (rename/delete). Nothing here touches `participants` or `events`
 * directly — those keep their own name copies (see db.js's schema comment)
 * and only carry a `person_id` link forward from the moment someone's added.
 */

/** All people, most recently used first — so autocomplete surfaces whoever
 * you've tagayed with most recently, not alphabetical order. */
export async function getPeople() {
  const db = getDatabase()
  const result = await db.query(
    'SELECT id, name, first_name, last_name, last_used_at FROM people ORDER BY last_used_at DESC',
  )
  return result.values ?? []
}

/** Resolves a typed name to a person: reuses an existing roster entry on an
 * exact case-insensitive match (bumping `last_used_at` so they stay near
 * the top of future suggestions), or creates a new one. Always returns a
 * person id — this is the one place new roster entries come from, matching
 * the design note that there's no separate "add to roster" button; adding
 * happens organically by typing a name at session start. */
export async function findOrCreatePerson(firstName, lastName = '') {
  const db = getDatabase()
  const first = firstName.trim()
  const last = (lastName || '').trim()
  const fullName = last ? `${first} ${last}` : first
  const now = new Date().toISOString()

  const existing = await db.query(
    'SELECT id FROM people WHERE name = ? COLLATE NOCASE LIMIT 1',
    [fullName],
  )
  const match = existing.values?.[0]
  if (match) {
    await db.run('UPDATE people SET last_used_at = ? WHERE id = ?', [now, match.id], false)
    return match.id
  }

  const id = crypto.randomUUID()
  await db.run(
    'INSERT INTO people (id, name, first_name, last_name, created_at, last_used_at, synced) VALUES (?, ?, ?, ?, ?, ?, 0)',
    [id, fullName, first, last || null, now, now],
    false,
  )
  return id
}

/** Renames a roster entry (the master name — a participant row from a past
 * session keeps its own separate copy, so this never rewrites history). */
export async function renamePerson(personId, firstName, lastName = '') {
  const db = getDatabase()
  const first = firstName.trim()
  const last = (lastName || '').trim()
  const fullName = last ? `${first} ${last}` : first
  await db.run(
    'UPDATE people SET name = ?, first_name = ?, last_name = ? WHERE id = ?',
    [fullName, first, last || null, personId],
    false,
  )
}

/** Removes someone from the roster. Past `participants` rows that reference
 * this id are left as-is (an orphaned person_id) rather than cleaned up —
 * harmless, since nothing currently joins back through it except future
 * suggestions/leaderboard aggregation, and those naturally stop surfacing a
 * deleted person going forward. */

export async function deletePerson(personId) {
  const db = getDatabase()
  await db.run('DELETE FROM people WHERE id = ?', [personId], false)
}
