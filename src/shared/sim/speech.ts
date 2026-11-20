/**
 * SIMULATED voice for the AI assistant (CP-35, PP-37, PA-11; source §13
 * "Hindi voice and text"). Uses the browser's speech recognition and speech
 * synthesis when present (hi-IN / en-IN); in production a Hindi speech
 * service would do this. Without browser support, listen() resolves undefined
 * and the panel uses a sample question instead.
 */

type Recognition = { lang: string; interimResults: boolean; maxAlternatives: number; start: () => void; stop: () => void; onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onerror: (() => void) | null; onend: (() => void) | null }

const recognitionCtor = (): (new () => Recognition) | undefined => {
  if (typeof window === 'undefined') return undefined
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition
}

export const canListen = () => !!recognitionCtor()

export function listen(lang: 'en' | 'hi', timeoutMs = 8000): Promise<string | undefined> {
  const Ctor = recognitionCtor()
  if (!Ctor) return Promise.resolve(undefined)
  return new Promise((resolve) => {
    let done = false
    const finish = (text?: string) => {
      if (done) return
      done = true
      resolve(text)
    }
    try {
      const r = new Ctor()
      r.lang = lang === 'hi' ? 'hi-IN' : 'en-IN'
      r.interimResults = false
      r.maxAlternatives = 1
      r.onresult = (e) => finish(e.results[0]?.[0]?.transcript)
      r.onerror = () => finish(undefined)
      r.onend = () => finish(undefined)
      r.start()
      setTimeout(() => (r.stop(), finish(undefined)), timeoutMs)
    } catch {
      finish(undefined)
    }
  })
}

export function speak(text: string, lang: 'en' | 'hi') {
  try {
    if (typeof window === 'undefined' || !window.speechSynthesis) return
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.lang = lang === 'hi' ? 'hi-IN' : 'en-IN'
    window.speechSynthesis.speak(u)
  } catch {
    /* no voice on this device */
  }
}
