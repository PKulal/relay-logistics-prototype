import { create } from 'zustand'
import type { DemoState } from './store'
import { freshState } from './store'
import { startSync } from './sync'

/** Two independent stores stand in for two browser tabs. */
function makeTab() {
  return create<DemoState>()((set) => ({
    ...freshState(),
    advanceTime: (m) => set({ demoNow: `+${m}` }),
    addEvents: () => {},
    setFlag: (flag, value) => set((s) => ({ flags: { ...s.flags, [flag]: value } })),
    resetDemo: () => set(freshState()),
  }))
}

const flush = () => new Promise((r) => setTimeout(r, 50))

describe('cross-tab sync', () => {
  it('applies a change made in one tab to the other', async () => {
    const tabA = makeTab()
    const tabB = makeTab()
    const stopA = startSync(tabA)
    const stopB = startSync(tabB)

    tabA.getState().setFlag('showSimulationLabels', true)
    await flush()
    expect(tabB.getState().flags.showSimulationLabels).toBe(true)

    tabB.getState().advanceTime(60)
    await flush()
    expect(tabA.getState().demoNow).toBe('+60')

    stopA()
    stopB()
  })

  it('does not echo a received update back (no loops)', async () => {
    const tabA = makeTab()
    const tabB = makeTab()
    const stopA = startSync(tabA)
    const stopB = startSync(tabB)

    let updatesInA = 0
    const unsub = tabA.subscribe(() => (updatesInA += 1))
    tabA.getState().setFlag('offline', true)
    await flush()
    expect(updatesInA).toBe(1)

    unsub()
    stopA()
    stopB()
  })
})
