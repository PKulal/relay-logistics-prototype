/**
 * SIMULATED: network latency. Every data load shows a 300–800 ms skeleton so the
 * prototype feels like a real app (design-system.md §7). Replace with real
 * request timing when an API exists.
 */
import { useEffect, useState } from 'react'

export function simulateLatency(minMs = 300, maxMs = 800): Promise<void> {
  // UI-only randomness (not demo data), so Math.random is fine here.
  const ms = minMs + Math.random() * (maxMs - minMs)
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** True for a short simulated load whenever `key` changes (e.g. a route or filter). */
export function useSimulatedLoading(key: unknown = 'once'): boolean {
  // Loading until the simulated request for the CURRENT key has finished.
  const [loadedKey, setLoadedKey] = useState<{ key: unknown }>()
  useEffect(() => {
    let cancelled = false
    void simulateLatency().then(() => !cancelled && setLoadedKey({ key }))
    return () => {
      cancelled = true
    }
  }, [key])
  return !loadedKey || !Object.is(loadedKey.key, key)
}
