/**
 * Cross-tab sync: every change in one tab is broadcast on
 * BroadcastChannel("logisco") and applied in the others, so a booking in the
 * Customer Portal appears in the ERP tab without a refresh.
 *
 * The full persisted state travels in the message, so receivers never read a
 * half-written localStorage. A flag stops a received update being re-broadcast.
 */
import type { StoreApi } from 'zustand'
import type { DemoState, PersistedDemoState } from './store'

export const CHANNEL_NAME = 'logisco'

interface SyncMessage {
  type: 'state'
  from: string
  state: PersistedDemoState
}

/** Start syncing a store with other tabs. Returns a function that stops it. */
export function startSync(store: StoreApi<DemoState>): () => void {
  if (typeof BroadcastChannel === 'undefined') return () => {}

  const tabId = crypto.randomUUID()
  const channel = new BroadcastChannel(CHANNEL_NAME)
  let applyingRemote = false

  const unsubscribe = store.subscribe((s, prev) => {
    if (applyingRemote) return
    if (s.data === prev.data && s.demoNow === prev.demoNow && s.flags === prev.flags) return
    const message: SyncMessage = { type: 'state', from: tabId, state: { data: s.data, demoNow: s.demoNow, flags: s.flags } }
    channel.postMessage(message)
  })

  channel.onmessage = (event: MessageEvent<SyncMessage>) => {
    const msg = event.data
    if (msg?.type !== 'state' || msg.from === tabId) return
    applyingRemote = true
    try {
      store.setState(msg.state)
    } finally {
      applyingRemote = false
    }
  }

  return () => {
    unsubscribe()
    channel.close()
  }
}
