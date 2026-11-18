/**
 * SIMULATED device feedback for scans (PA-07): a beep, a vibration and a short
 * voice prompt in the app language (Partner App spec §9.2). Uses the browser's
 * Web Audio, Vibration and Speech Synthesis APIs; silently does nothing where
 * they are missing (tests, desktop browsers without speech voices).
 */
let ctx: AudioContext | undefined

export function beep(ok: boolean) {
  try {
    ctx ??= new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.frequency.value = ok ? 1046 : 220
    gain.gain.value = 0.08
    osc.connect(gain).connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + (ok ? 0.08 : 0.25))
  } catch {
    /* no audio available */
  }
}

export function vibrate(ok: boolean) {
  try {
    navigator.vibrate?.(ok ? 40 : [60, 40, 60])
  } catch {
    /* no vibration available */
  }
}

export function speak(text: string, language: 'en' | 'hi') {
  try {
    const synth = window.speechSynthesis
    if (!synth) return
    synth.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.lang = language === 'hi' ? 'hi-IN' : 'en-IN'
    u.rate = 1.1
    synth.speak(u)
  } catch {
    /* no speech available */
  }
}
