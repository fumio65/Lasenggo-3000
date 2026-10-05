import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!url || !publishableKey) {
  console.warn(
    'Supabase env vars missing (VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY). ' +
      'Sync will stay disabled — the app still works fully offline. See .env.example.'
  )
}

// Only created when both env vars are present. Every call site must treat sync as
// optional: offline-first means the app's core loop never depends on this existing.
export const supabase = url && publishableKey ? createClient(url, publishableKey) : null
