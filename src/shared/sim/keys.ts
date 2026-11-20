/**
 * SIMULATED: API keys, webhook signing secrets and webhook test deliveries
 * (CP-32, PP-35). In production a key service issues random secrets and the
 * test event is a real HTTPS POST; here keys are derived from a seed string so
 * the demo is repeatable, and every test delivery to an HTTPS URL returns 200.
 */

function hex(seed: string, length: number): string {
  let h = 2166136261
  let out = ''
  while (out.length < length) {
    for (const ch of seed + out.length) h = Math.imul(h ^ ch.charCodeAt(0), 16777619)
    out += (h >>> 0).toString(16).padStart(8, '0')
  }
  return out.slice(0, length)
}

/** e.g. lg_sbx_3f9c…91af. Shown in full once; only the last 4 are stored. */
export function simulateApiKey(env: 'sandbox' | 'production', seed: string): string {
  return `lg_${env === 'sandbox' ? 'sbx' : 'live'}_${hex(seed, 32)}`
}

export function simulateSecret(seed: string): string {
  return `whsec_${hex(`secret:${seed}`, 24)}`
}

/** Mock response to "Send test event". */
export function simulateWebhookTest(url: string): { status: number; ms: number } {
  return url.startsWith('https://') ? { status: 200, ms: 180 + (url.length % 7) * 23 } : { status: 0, ms: 0 }
}
