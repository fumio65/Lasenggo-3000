// supabase-js wraps a failed fetch in different shapes depending on which
// call failed (a plain TypeError from the raw fetch, or an
// AuthRetryableFetchError/AuthUnknownError from the auth client), so matching
// the error itself is brittle. navigator.onLine is the one signal the
// browser/WebView gives directly for "no connection" and is reliable enough
// for this: if we're offline, any failure here is the expected offline case,
// not a real bug. Shared by syncJob.js (push) and pull.js (pull).
export function isNetworkError(err) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true
  return err instanceof TypeError && /fetch|network/i.test(err.message ?? '')
}
