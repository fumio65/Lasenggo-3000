/**
 * app/turn-timer: a short two-beep buzzer for when someone's time limit
 * runs out. Synthesized with the Web Audio API instead of an audio file —
 * no asset to bundle or fail to load, and it matches this app's
 * offline-first stance (ARCHITECTURE.md): nothing here depends on a
 * network round-trip or even a successful file fetch.
 *
 * One `AudioContext` is created lazily and reused across calls (creating
 * a new one per beep is wasteful and some browsers cap how many can
 * exist at once); `resume()` is called every time since a context
 * created or left suspended by browser autoplay policy needs an explicit
 * resume from within a user-gesture call stack, which this always is
 * (the turn timer's own tick, triggered by a Pass/Pour the person just
 * made).
 */
let audioCtx = null

function getAudioContext() {
  if (!audioCtx) {
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!Ctx) return null
    audioCtx = new Ctx()
  }
  return audioCtx
}

function beep(ctx, startTime, durationSeconds, frequencyHz) {
  const oscillator = ctx.createOscillator()
  const gain = ctx.createGain()
  oscillator.type = 'square'
  oscillator.frequency.value = frequencyHz
  // Quick fade in/out instead of a hard on/off edge — a squarewave
  // snapping straight to full volume and back produces an audible
  // click/pop at each boundary.
  gain.gain.setValueAtTime(0, startTime)
  gain.gain.linearRampToValueAtTime(0.25, startTime + 0.02)
  gain.gain.linearRampToValueAtTime(0, startTime + durationSeconds)
  oscillator.connect(gain)
  gain.connect(ctx.destination)
  oscillator.start(startTime)
  oscillator.stop(startTime + durationSeconds)
}

/** app/turn-timer (ticking): one short clock tick per second while the
 * turn timer runs. Alternates a higher "tick" and lower "tock" so it reads
 * as a clock rather than a metronome beep. `urgent` (the last 5 seconds)
 * makes it higher and louder to build tension before the buzzer. A sine
 * wave with a very short decay sounds like a click, not a tone, and stays
 * quieter than the buzzer so the buzzer still stands out. */
export function playTick(isTock = false, urgent = false) {
  const ctx = getAudioContext()
  if (!ctx) return
  ctx.resume().catch(() => {})
  const now = ctx.currentTime
  const oscillator = ctx.createOscillator()
  const gain = ctx.createGain()
  oscillator.type = 'sine'
  oscillator.frequency.value = urgent ? (isTock ? 1500 : 1800) : isTock ? 900 : 1200
  const peak = urgent ? 0.22 : 0.12
  gain.gain.setValueAtTime(0, now)
  gain.gain.linearRampToValueAtTime(peak, now + 0.004)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.06)
  oscillator.connect(gain)
  gain.connect(ctx.destination)
  oscillator.start(now)
  oscillator.stop(now + 0.07)
}

/** Creates/resumes the shared AudioContext from inside a tap. Android's
 * WebView (and mobile browsers) keep audio suspended until a user gesture,
 * and the ticks themselves fire from a timer, not a tap. Calling this when
 * the person picks a timer duration unlocks sound for the ticks after it. */
export function primeAudio() {
  const ctx = getAudioContext()
  if (ctx) ctx.resume().catch(() => {})
}

/** Plays the two-beep buzzer. Silently does nothing if the Web Audio API
 * isn't available at all (very old/unusual browsers) — a missed sound
 * cue is a minor degradation, not worth a visible error for. */
export function playBuzzer() {
  const ctx = getAudioContext()
  if (!ctx) return
  ctx.resume().catch(() => {})
  const now = ctx.currentTime
  beep(ctx, now, 0.18, 880)
  beep(ctx, now + 0.22, 0.18, 880)
}
