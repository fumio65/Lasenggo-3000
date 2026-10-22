import { useEffect, useState } from 'react'

/**
 * app/turn-timer: an optional per-turn countdown — "look more intense"
 * (user's own framing), not a house rule. `durationSeconds` is null when
 * the feature is off (the default); any other value is a positive
 * integer picked from the mid-session control's presets.
 *
 * `turnKey` identifies *whose turn this counting applies to* — the
 * caller passes `currentIndex` from useTurnManager, since that's
 * guaranteed to change exactly when the turn actually advances (a Pass,
 * a confirmed Pour, or a paused participant being skipped), and nothing
 * else. Every time `turnKey` or `durationSeconds` changes, the clock
 * resets to a fresh `durationSeconds` and `expired` clears — so turning
 * the timer on mid-turn starts counting immediately from the full
 * duration, same as a fresh turn would.
 *
 * Deliberately a *soft* signal only, same philosophy as the existing
 * pass-limit house rule (see useTurnManager's own doc comment): this
 * hook never calls onPass or any other turn-advancing action itself.
 * `expired` just flips to true once the clock hits zero; the caller
 * decides what that means (here: a buzzer sound + a flashing badge,
 * nothing else — Pass and Pour both keep working normally past zero).
 */
// app/drink-timer: the session screen now uses this to time the *drinking*
// rather than the Pour/Pass decision. It passes a `turnKey` that's unique
// per pour ('pour-<n>', or 'idle' between pours), so each pour starts a
// fresh countdown and clearing it resets to full. `running` false holds
// the countdown where it is (here: at full, while nobody is drinking)
// without resetting it.
export function useTurnTimer(turnKey, durationSeconds, running = true) {
  const [secondsLeft, setSecondsLeft] = useState(durationSeconds)
  const [expired, setExpired] = useState(false)

  // Reset on a new turn or a changed/toggled duration.
  useEffect(() => {
    setSecondsLeft(durationSeconds)
    setExpired(false)
    // turnKey is intentionally part of this effect's trigger even though
    // it's never read inside it — it's the "whose turn" identity that
    // should force a reset.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turnKey, durationSeconds])

  // The actual ticking — disabled (durationSeconds null) means no timer
  // ever runs at all, not just one that never reaches zero.
  //
  // Bug fix (app/turn-timer follow-up): turning the timer on (or
  // switching it to a new duration) changes `durationSeconds` in the
  // same render where `secondsLeft` is still whatever it was before —
  // `null` if the timer had been off. This effect reruns on that render
  // (its deps include `durationSeconds`) *before* the reset effect
  // above has had a chance to apply the fresh `secondsLeft`, so without
  // the `secondsLeft == null` guard, `secondsLeft <= 0` was evaluating
  // `null <= 0`, which JS coerces to `0 <= 0` — true — and fired the
  // buzzer immediately, even though the real countdown hadn't started.
  // Treating `null` as "not ready yet" instead of "expired" closes that
  // race; the reset effect's own update then makes this effect rerun
  // with the real starting value.
  useEffect(() => {
    if (durationSeconds == null || secondsLeft == null) return
    // Checked before the expiry test on purpose. When a countdown that has
    // already hit 0 is stopped and reset (pour resolved after time-up),
    // this effect reruns in the same commit as the reset effect above,
    // still seeing the old 0; checking expiry first re-set `expired` right
    // after the reset cleared it, leaving "Time's up!" stuck on the next
    // person. A stopped timer can't expire anyway.
    if (!running) return
    if (secondsLeft <= 0) {
      setExpired(true)
      return
    }
    const id = setTimeout(() => setSecondsLeft((s) => s - 1), 1000)
    return () => clearTimeout(id)
  }, [secondsLeft, durationSeconds, running])

  return {
    running: durationSeconds != null && running,
    secondsLeft: durationSeconds == null ? null : secondsLeft,
    expired: durationSeconds != null && expired,
  }
}
