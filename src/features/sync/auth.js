import { supabase } from './supabaseClient'

// Ensures an anonymous Supabase session exists for this device and returns its
// device_id (the anonymous auth user's id). supabase-js persists the session to
// localStorage by default, so calling this again after an app restart resolves the
// *same* session instead of creating a new one — that's what gives each device a
// stable identity across restarts without any login.
//
// Returns null if Supabase isn't configured (see supabaseClient.js) or the call
// fails — sync is always optional, so callers must handle null and keep working
// offline rather than throwing.
export async function ensureAnonymousSession() {
  if (!supabase) return null

  try {
    const { data: existing, error: getError } = await supabase.auth.getSession()
    if (getError) throw getError

    if (existing.session) {
      return existing.session.user.id
    }

    const { data, error } = await supabase.auth.signInAnonymously()
    if (error) throw error

    return data.session?.user.id ?? null
  } catch (err) {
    console.error('Anonymous sign-in failed, continuing offline-only', err)
    return null
  }
}

// Convenience accessor for the current device_id without re-triggering sign-in.
// Returns null if there's no active session (not yet signed in, or sync disabled).
export async function getDeviceId() {
  if (!supabase) return null
  const { data } = await supabase.auth.getSession()
  return data.session?.user.id ?? null
}
